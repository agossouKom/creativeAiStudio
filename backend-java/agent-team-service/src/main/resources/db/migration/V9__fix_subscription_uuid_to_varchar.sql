-- Fix: id columns were declared as UUID in PostgreSQL but Java entities use String.
-- Converting to varchar(36) so Hibernate can bind values without type cast errors.
ALTER TABLE user_subscriptions  ALTER COLUMN id TYPE varchar(36) USING id::varchar;
ALTER TABLE subscription_usage  ALTER COLUMN id TYPE varchar(36) USING id::varchar;
