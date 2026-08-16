import pika
import time
import os
import json
import boto3
import cv2
import numpy as np
from paddleocr import PaddleOCR
from dotenv import load_dotenv

load_dotenv()

# Config
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'localhost:9000')
MINIO_ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
MINIO_SECRET_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin')

TASK_QUEUE = 'ocr.queue'
RESULT_QUEUE = 'results.queue'

# Initialize PaddleOCR (use_angle_cls=True for better rotation handling)
ocr_engine = PaddleOCR(use_angle_cls=True, lang='fr') # Default to French

# Initialize MinIO client
s3 = boto3.client('s3',
                  endpoint_url=f"http://{MINIO_ENDPOINT}" if "http" not in MINIO_ENDPOINT else MINIO_ENDPOINT,
                  aws_access_key_id=MINIO_ACCESS_KEY,
                  aws_secret_access_key=MINIO_SECRET_KEY,
                  region_name='us-east-1')

def send_result(result_data):
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()
    channel.queue_declare(queue=RESULT_QUEUE, durable=True)
    channel.basic_publish(
        exchange='',
        routing_key=RESULT_QUEUE,
        body=json.dumps(result_data),
        properties=pika.BasicProperties(delivery_mode=2)
    )
    connection.close()

def process_ocr(ch, method, properties, body):
    data = json.loads(body)
    file_name = data.get('fileName')
    bucket_name = data.get('bucketName')
    
    print(f" [x] Processing OCR for: {file_name}")
    
    try:
        # 1. Download from MinIO
        response = s3.get_object(Bucket=bucket_name, Key=file_name)
        file_bytes = response['Body'].read()
        
        # 2. Convert to OpenCV format
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Could not decode image")

        # 3. Perform OCR
        result = ocr_engine.ocr(img, cls=True)
        
        # 4. Format results
        extracted_text = ""
        for line in result:
            for word_info in line:
                extracted_text += word_info[1][0] + " "
        
        print(f" [v] OCR Success. Extracted {len(extracted_text)} chars.")

        # 5. Send result back to Java
        send_result({
            "fileName": file_name,
            "status": "COMPLETED",
            "text": extracted_text.strip(),
            "timestamp": time.time()
        })
        
    except Exception as e:
        print(f" [!] OCR Failed: {str(e)}")
        send_result({
            "fileName": file_name,
            "status": "FAILED",
            "error": str(e)
        })

    ch.basic_ack(delivery_tag=method.delivery_tag)

def main():
    print(f" [*] Connecting to RabbitMQ at {RABBITMQ_HOST}...")
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()

    channel.queue_declare(queue=TASK_QUEUE, durable=True)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=TASK_QUEUE, on_message_callback=process_ocr)

    print(' [*] OCR Service with PaddleOCR is ready. Waiting for tasks...')
    channel.start_consuming()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Interrupted')
        try:
            exit(0)
        except SystemExit:
            os._exit(0)
