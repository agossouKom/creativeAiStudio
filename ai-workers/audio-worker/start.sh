#!/bin/sh
python -m app.kafka_worker &
uvicorn app.main:app --host 0.0.0.0 --port 8001
