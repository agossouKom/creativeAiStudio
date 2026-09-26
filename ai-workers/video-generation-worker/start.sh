#!/bin/sh
python -m app.kafka_worker &
exec uvicorn app.main:app --host 0.0.0.0 --port 8006
