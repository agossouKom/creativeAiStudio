import base64
import hashlib
import unittest

from app.storage import MinioImageStorage, StorageError


PNG = b"\x89PNG\r\n\x1a\n" + b"pixel-data" * 8
JPEG = b"\xff\xd8\xff\xe0" + b"jpeg-data" * 8
PNG_B64 = base64.b64encode(PNG).decode()


def _real_png():
    """PNG 2x2 vrai, pour tester la conversionJPEG -> PNG."""
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (2, 2), (200, 30, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def _real_jpeg():
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (2, 2), (200, 30, 30)).save(buffer, format="JPEG")
    return buffer.getvalue()


class FakeResponse:
    def __init__(self, chunks, *, content_type="image/png", content_length=None, status_code=200):
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
        self.objects.append(dict(kwargs))

    def head_bucket(self, **kwargs):
        return None

    def create_bucket(self, **kwargs):
        self.buckets.append(kwargs["Bucket"])


def _public_resolver(host):
    return ["93.184.216.34"]


class MinioImageStorageTest(unittest.TestCase):
    def _storage(
        self, session, max_output_bytes=4096, resolver=_public_resolver,
        output_format="png",
    ):
        s3 = FakeS3()
        return (
            MinioImageStorage(
                "http://minio:9000",
                "access",
                "secret",
                "image-generation-results",
                max_output_bytes,
                10,
                output_format,
                session=session,
                s3_client=s3,
                resolver=resolver,
            ),
            s3,
        )

    def test_stores_base64_image_as_durable_object(self):
        storage, s3 = self._storage(FakeSession(FakeResponse([])))
        stored = storage.store_base64(
            PNG_B64, job_id="job/unsafe", execution_version=2, index=1
        )
        self.assertEqual(s3.objects[0]["Bucket"], "image-generation-results")
        self.assertTrue(stored.object_key.startswith("results/job-unsafe-"))
        self.assertTrue(stored.object_key.endswith("/2/image-1.png"))
        self.assertEqual(s3.objects[0]["Body"], PNG)
        self.assertEqual(s3.objects[0]["ContentType"], "image/png")
        self.assertEqual(stored.sha256, hashlib.sha256(PNG).hexdigest())
        self.assertEqual(stored.payload()["objectKey"], stored.object_key)

    def test_converts_provider_jpeg_to_png(self):
        # Le provider peut renvoyer du JPEG alors que le format impose est PNG.
        # Le stockage ne doit plus le ranger tel quel.
        storage, s3 = self._storage(FakeSession(FakeResponse([])))
        stored = storage.store_base64(
            base64.b64encode(_real_jpeg()).decode(),
            job_id="job-1",
            execution_version=1,
            index=3,
        )
        self.assertEqual(stored.content_type, "image/png")
        self.assertTrue(stored.object_key.endswith("image-3.png"))
        self.assertEqual(s3.objects[0]["ContentType"], "image/png")
        self.assertTrue(s3.objects[0]["Body"].startswith(b"\x89PNG\r\n\x1a\n"))
        # pas d'egalite d'octets : le JPEG est deja passe par une compression
        # lossy, le PNG reconverti ne peut pas etre identique a l'original
        self.assertNotEqual(s3.objects[0]["Body"], JPEG)

    def test_keeps_png_untouched(self):
        storage, s3 = self._storage(FakeSession(FakeResponse([])))
        stored = storage.store_base64(
            PNG_B64, job_id="job-1", execution_version=1, index=1
        )
        self.assertEqual(s3.objects[0]["Body"], PNG)
        self.assertEqual(stored.sha256, hashlib.sha256(PNG).hexdigest())

    def test_honours_explicit_webp_target(self):
        storage, s3 = self._storage(FakeSession(FakeResponse([])), output_format="webp")
        stored = storage.store_base64(
            base64.b64encode(_real_png()).decode(),
            job_id="job-1",
            execution_version=1,
            index=2,
        )
        self.assertEqual(stored.content_type, "image/webp")
        self.assertTrue(stored.object_key.endswith("image-2.webp"))
        self.assertEqual(s3.objects[0]["ContentType"], "image/webp")
        self.assertTrue(s3.objects[0]["Body"].startswith(b"RIFF"))

    def test_rejects_corrupt_image_when_conversion_required(self):
        # des octets JPEG invalides ne doivent pas passer pour une image
        storage, _ = self._storage(FakeSession(FakeResponse([])))
        with self.assertRaisesRegex(StorageError, "could not be converted"):
            storage.store_base64(
                base64.b64encode(JPEG).decode(),
                job_id="job-1",
                execution_version=1,
                index=4,
            )

    def test_accepts_data_url_payload(self):
        storage, _ = self._storage(FakeSession(FakeResponse([])))
        stored = storage.store_base64(
            f"data:image/png;base64,{PNG_B64}", job_id="job-1", execution_version=1, index=1
        )
        self.assertEqual(stored.size_bytes, len(PNG))

    def test_rejects_non_image_base64(self):
        storage, _ = self._storage(FakeSession(FakeResponse([])))
        with self.assertRaisesRegex(StorageError, "not a supported image"):
            storage.store_base64(
                base64.b64encode(b"<html>error page</html>").decode(),
                job_id="job-1",
                execution_version=1,
                index=1,
            )

    def test_rejects_non_base64_data_url(self):
        storage, _ = self._storage(FakeSession(FakeResponse([])))
        with self.assertRaisesRegex(StorageError, "not an image"):
            storage.store_base64(
                "data:text/plain;base64,aGVsbG8=",
                job_id="job-1",
                execution_version=1,
                index=1,
            )

    def test_rejects_oversized_base64_before_decoding(self):
        storage, _ = self._storage(FakeSession(FakeResponse([])), max_output_bytes=8)
        with self.assertRaisesRegex(StorageError, "size limit"):
            storage.store_base64(PNG_B64, job_id="job-1", execution_version=1, index=1)

    def test_downloads_public_url_and_stores_object(self):
        response = FakeResponse([PNG[:10], PNG[10:]], content_type="image/png")
        session = FakeSession(response)
        storage, s3 = self._storage(session)
        stored = storage.store_url(
            "https://cdn.example.com/out/1.png",
            job_id="job-1",
            execution_version=1,
            index=1,
        )
        self.assertEqual(session.calls[0][0], "https://cdn.example.com/out/1.png")
        self.assertFalse(session.calls[0][1]["allow_redirects"])
        self.assertEqual(s3.objects[0]["Body"], PNG)
        self.assertEqual(stored.size_bytes, len(PNG))
        self.assertTrue(response.closed)

    def test_rejects_url_resolving_to_private_address(self):
        storage, _ = self._storage(
            FakeSession(FakeResponse([PNG])), resolver=lambda host: ["169.254.169.254"]
        )
        with self.assertRaisesRegex(StorageError, "non-public address"):
            storage.store_url(
                "https://metadata.example.com/latest",
                job_id="job-1",
                execution_version=1,
                index=1,
            )

    def test_rejects_localhost_url(self):
        storage, _ = self._storage(FakeSession(FakeResponse([PNG])))
        with self.assertRaisesRegex(StorageError, "not allowed"):
            storage.store_url(
                "http://localhost:9000/secret.png",
                job_id="job-1",
                execution_version=1,
                index=1,
            )

    def test_rejects_url_with_credentials(self):
        storage, _ = self._storage(FakeSession(FakeResponse([PNG])))
        with self.assertRaisesRegex(StorageError, "URL is invalid"):
            storage.store_url(
                "https://user:pass@cdn.example.com/1.png",
                job_id="job-1",
                execution_version=1,
                index=1,
            )

    def test_rejects_redirect(self):
        response = FakeResponse([PNG], status_code=302)
        storage, _ = self._storage(FakeSession(response))
        with self.assertRaisesRegex(StorageError, "redirected"):
            storage.store_url(
                "https://cdn.example.com/1.png",
                job_id="job-1",
                execution_version=1,
                index=1,
            )

    def test_rejects_declared_length_over_limit(self):
        response = FakeResponse([PNG], content_length=999999)
        storage, _ = self._storage(FakeSession(response), max_output_bytes=16)
        with self.assertRaisesRegex(StorageError, "size limit"):
            storage.store_url(
                "https://cdn.example.com/1.png",
                job_id="job-1",
                execution_version=1,
                index=1,
            )

    def test_rejects_empty_download(self):
        storage, _ = self._storage(FakeSession(FakeResponse([])))
        with self.assertRaisesRegex(StorageError, "empty"):
            storage.store_url(
                "https://cdn.example.com/1.png",
                job_id="job-1",
                execution_version=1,
                index=1,
            )

    def test_creates_missing_bucket(self):
        class MissingBucketS3(FakeS3):
            def head_bucket(self, **kwargs):
                raise RuntimeError("missing")

        s3 = MissingBucketS3()
        storage = MinioImageStorage(
            "http://minio:9000",
            "access",
            "secret",
            "image-generation-results",
            4096,
            10,
            session=FakeSession(FakeResponse([])),
            s3_client=s3,
            resolver=_public_resolver,
        )
        storage.ensure_bucket()
        self.assertEqual(s3.buckets, ["image-generation-results"])

    def test_bucket_creation_failure_is_reported(self):
        class BrokenS3(FakeS3):
            def head_bucket(self, **kwargs):
                raise RuntimeError("missing")

            def create_bucket(self, **kwargs):
                raise RuntimeError("unreachable")

        storage = MinioImageStorage(
            "http://minio:9000",
            "access",
            "secret",
            "image-generation-results",
            4096,
            10,
            session=FakeSession(FakeResponse([])),
            s3_client=BrokenS3(),
            resolver=_public_resolver,
        )
        with self.assertRaisesRegex(StorageError, "storage is unavailable"):
            storage.ensure_bucket()


if __name__ == "__main__":
    unittest.main()
