-- Provider success means the message was accepted by the provider, not necessarily delivered to the customer.
ALTER TYPE "MessageDeliveryStatus" RENAME VALUE 'QUEUED' TO 'ACCEPTED';
