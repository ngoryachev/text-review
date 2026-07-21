// Text review tool: local web UI for annotating text.
//
// Starts an HTTP server, opens the browser, waits until the user clicks
// "Send to CLI & finish" in the UI, prints the composed prompt to stdout
// and exits. All logs go to stderr, so it is safe to use as
// feedback=$(text-review plan.md).
package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"
)

//go:embed index.html
var indexHTML []byte

func readText(fileArg string) (string, error) {
	if fileArg == "-" {
		data, err := io.ReadAll(os.Stdin)
		return string(data), err
	}
	if fileArg != "" {
		data, err := os.ReadFile(fileArg)
		return string(data), err
	}
	if stat, err := os.Stdin.Stat(); err == nil && stat.Mode()&os.ModeCharDevice == 0 {
		data, err := io.ReadAll(os.Stdin)
		return string(data), err
	}
	return "", nil
}

// openBrowser launches the platform opener with stdout/stderr detached,
// so nothing pollutes our stdout (reserved for the prompt).
func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func main() {
	port := flag.Int("port", 0, "port (default: a free one chosen by the OS)")
	noOpen := flag.Bool("no-open", false, "do not open the browser automatically")
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr,
			"Usage: %s [flags] [FILE]\n\nAnnotate text in the browser and print the feedback prompt to stdout.\n"+
				"FILE: file with the text ('-' for stdin; with no argument: stdin if piped,\n"+
				"otherwise an empty paste field in the UI).\n\nFlags:\n", os.Args[0])
		flag.PrintDefaults()
	}
	flag.Parse()

	fileArg := flag.Arg(0)
	text, err := readText(fileArg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to read input: %v\n", err)
		os.Exit(1)
	}
	text = strings.ReplaceAll(text, "\r\n", "\n")

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to listen: %v\n", err)
		os.Exit(1)
	}
	url := fmt.Sprintf("http://%s/", listener.Addr())

	done := make(chan string, 1)
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(indexHTML)
	})
	mux.HandleFunc("GET /api/text", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(map[string]string{"text": text})
	})
	mux.HandleFunc("POST /api/submit", func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Prompt *string `json:"prompt"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Prompt == nil {
			http.Error(w, `{"error": "prompt must be a string"}`, http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Write([]byte(`{"ok": true}`))
		done <- *payload.Prompt
	})

	server := &http.Server{Handler: mux}
	go server.Serve(listener)

	fmt.Fprintf(os.Stderr, "Text review: %s (Ctrl+C to quit without a result)\n", url)
	if !*noOpen {
		openBrowser(url)
	}

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)

	select {
	case prompt := <-done:
		// graceful shutdown flushes the in-flight /api/submit response
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		server.Shutdown(ctx)
		fmt.Println(prompt)
	case <-interrupt:
		fmt.Fprintln(os.Stderr, "\nInterrupted.")
		os.Exit(130)
	}
}
