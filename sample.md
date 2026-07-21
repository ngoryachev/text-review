# Migration plan: move the billing service to the new queue

## Step 1. Dual writes

We start writing every billing event to both the old Redis queue and the new
Kafka topic. The consumer keeps reading from Redis only, so behaviour does not
change. A feature flag `billing.dual_write` controls the rollout.

## Step 2. Shadow consumption

A new consumer reads the Kafka topic and processes events in dry-run mode,
comparing its results with the production consumer. Discrepancies are logged
to the `billing_shadow_diff` table for a week.

## Step 3. Cutover

Once the diff rate is below 0.01%, we flip the `billing.primary_queue` flag to
Kafka, keep the Redis path for one more release as a fallback, and then delete
the old consumer code.

## Open questions

The retry policy for poisoned messages is still undecided, and we have not
agreed on who owns the dead-letter queue dashboard.
