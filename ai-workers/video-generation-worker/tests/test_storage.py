import hashlib
import tempfile
import unittest
from pathlib import Path

from app.storage import MinioVideoStorage, StorageError


class FakeResponse:
    def __init__(self, chunks, *, content_type="video/mp4", content_length=None, status_code=200):
        self.chunks = list(chunks)
        self.status_code = status_code
        self.headers = {"Content-Type": content_type}
        if content_length is not None:
            self.headers["Content-Length"] = str(content_length)
        self.closed = False

    def iter_content(self, chunk_size):
        yield from self.chunks

    def close(self):
        self.closed = True


class FakeSession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


class FakeS3:
    def __init__(self):
        self.objects = []
        self.buckets = []

    def put_object(self, **kwargs):
        copied = dict(kwargs)
        copied["Body"] = copied["Body"].read()
        self.objects.append(copied)

    def head_bucket(self, **kwargs):
        return None

    def create_bucket(self, **kwargs):
        self.buckets.append(kwargs["Bucket"])


class MinioVideoStorageTest(unittest.TestCase):
    def _storage(self, session, max_output_bytes=1024):
        s3 = FakeS3()
        return (
            MinioVideoStorage(
                "http://minio:9000",
                "access",
                "secret",
                "video-generation-results",
                max_output_bytes,
                10,
                session=session,
                s3_client=s3,
            ),
            s3,
        )

    def test_stores_provider_output_as_durable_object(self):
        payload = b"\x00\x00\x00\x18ftypmp42video"
        response = FakeResponse([payload[:8], payload[8:]], content_length=len(payload))
        session = FakeSession(response)
        storage, s3 = self._storage(session)

        stored = storage.store_output(
            "/tasks/provider-1/final-1.mp4",
            job_id="job/unsafe",
            execution_version=2,
            index=1,
            provider_base_url="http://moneyprinter:8080",
        )

        self.assertEqual(session.calls[0][0], "http://moneyprinter:8080/tasks/provider-1/final-1.mp4")
        self.assertEqual(s3.objects[0]["Bucket"], "video-generation-results")
        self.assertEqual(s3.objects[0]["Key"], stored.object_key)
        self.assertEqual(s3.objects[0]["Body"], payload)
        self.assertEqual(stored.sha256, hashlib.sha256(payload).hexdigest())
        self.assertEqual(stored.size_bytes, len(payload))
        self.assertTrue(response.closed)

    def test_rejects_output_on_another_host(self):
        storage, _ = self._storage(FakeSession(FakeResponse([b"video"])))
        with self.assertRaisesRegex(StorageError, "configured provider host"):
            storage.store_output(
                "https://other.example/video.mp4",
                job_id="job-1",
                execution_version=1,
                index=1,
                provider_base_url="http://moneyprinter:8080",
            )

    def test_rejects_declared_output_over_limit(self):
        response = FakeResponse([b"video"], content_length=2)
        storage, _ = self._storage(FakeSession(response), max_output_bytes=1)
        with self.assertRaisesRegex(StorageError, "size limit"):
            storage.store_output(
                "/tasks/provider-1/final-1.mp4",
                job_id="job-1",
                execution_version=1,
                index=1,
                provider_base_url="http://moneyprinter:8080",
            )

    def test_rejects_non_video_content(self):
        response = FakeResponse([b"not a video"], content_type="application/pdf")
        storage, _ = self._storage(FakeSession(response))
        with self.assertRaisesRegex(StorageError, "not a video"):
            storage.store_output(
                "/tasks/provider-1/final-1.mp4",
                job_id="job-1",
                execution_version=1,
                index=1,
                provider_base_url="http://moneyprinter:8080",
            )

    def test_creates_missing_bucket(self):
        class MissingBucketS3(FakeS3):
            def head_bucket(self, **kwargs):
                raise RuntimeError("missing")

        s3 = MissingBucketS3()
        storage = MinioVideoStorage(
            "http://minio:9000",
            "access",
            "secret",
            "video-generation-results",
            1024,
            10,
            session=FakeSession(FakeResponse([b"video"])),
            s3_client=s3,
        )
        storage.ensure_bucket()
        self.assertEqual(s3.buckets, ["video-generation-results"])

    def test_stores_local_mp4_with_durable_metadata(self):
        storage, s3 = self._storage(FakeSession(FakeResponse([b"unused"])))
        payload = b"\x00\x00\x00\x18ftypmp42localvideo"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.mp4"
            path.write_bytes(payload)
            stored = storage.store_file(
                path,
                job_id="job-1",
                execution_version=2,
                index=1,
            )
        self.assertEqual(s3.objects[0]["Body"], payload)
        self.assertEqual(stored.sha256, hashlib.sha256(payload).hexdigest())
        self.assertEqual(stored.size_bytes, len(payload))
        self.assertEqual(stored.content_type, "video/mp4")
        self.assertEqual(stored.object_key, "results/job-1/2/video-1.mp4")

    def test_rejects_invalid_local_media_before_upload(self):
        storage, s3 = self._storage(FakeSession(FakeResponse([b"unused"])))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "not-video.mp4"
            path.write_bytes(b"not an mp4 file")
            with self.assertRaisesRegex(StorageError, "not an MP4"):
                storage.store_file(
                    path,
                    job_id="job-1",
                    execution_version=1,
                    index=1,
                )
        self.assertEqual(s3.objects, [])


if __name__ == "__main__":
    unittest.main()
