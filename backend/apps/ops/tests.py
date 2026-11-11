import json
import os
import tempfile
import time

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.identity.models import User


class OpsApiTests(TestCase):
    def setUp(self):
        self.data = tempfile.TemporaryDirectory()
        self.bk = tempfile.TemporaryDirectory()
        self.addCleanup(self.data.cleanup)
        self.addCleanup(self.bk.cleanup)
        self.override = override_settings(OPS_DATA_DIR=self.data.name, OPS_BACKUP_DIR=self.bk.name)
        self.override.enable()
        self.addCleanup(self.override.disable)

        mk = lambda phone, **kw: User.objects.create_user(phone_number=phone, password="x", **kw)
        self.superuser = mk("09120000001", role="ADMIN", is_staff=True, is_superuser=True)
        self.admin = mk("09120000002", role="ADMIN")
        self.client_user = mk("09120000003", role="CLIENT")

        with open(os.path.join(self.bk.name, "4sogh_2026-11-01_0315.dump"), "wb") as fh:
            fh.write(b"PGDMP-test")
        with open(os.path.join(self.bk.name, "secret.txt"), "w") as fh:
            fh.write("nope")

    def _as(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    def test_anonymous_and_client_denied(self):
        self.assertEqual(APIClient().get("/api/v1/ops/health/").status_code, 401)
        self.assertEqual(self._as(self.client_user).get("/api/v1/ops/health/").status_code, 403)

    def test_health_missing_and_present(self):
        r = self._as(self.admin).get("/api/v1/ops/health/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["available"])

        os.makedirs(os.path.join(self.data.name, "status"))
        with open(os.path.join(self.data.name, "status", "health.json"), "w") as fh:
            json.dump({"generated_at": time.time(), "checks": {"api": {"ok": True}}}, fh)
        r = self._as(self.admin).get("/api/v1/ops/health/")
        self.assertTrue(r.data["available"])
        self.assertFalse(r.data["stale"])

    def test_backup_list_only_matching_names(self):
        r = self._as(self.admin).get("/api/v1/ops/backups/")
        names = [i["name"] for i in r.data["results"]]
        self.assertEqual(names, ["4sogh_2026-11-01_0315.dump"])
        self.assertFalse(r.data["can_manage"])

    def test_run_requires_superuser_and_is_single_flight(self):
        self.assertEqual(self._as(self.admin).post("/api/v1/ops/backups/run/").status_code, 403)
        su = self._as(self.superuser)
        self.assertEqual(su.post("/api/v1/ops/backups/run/").status_code, 202)
        self.assertTrue(os.path.exists(os.path.join(self.data.name, "requests", "backup.req")))
        self.assertEqual(su.post("/api/v1/ops/backups/run/").status_code, 409)

    def test_download_rules(self):
        su = self._as(self.superuser)
        ok = su.get("/api/v1/ops/backups/4sogh_2026-11-01_0315.dump/download/")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(b"".join(ok.streaming_content), b"PGDMP-test")
        self.assertEqual(su.get("/api/v1/ops/backups/secret.txt/download/").status_code, 404)
        self.assertEqual(su.get("/api/v1/ops/backups/..%2Fsecret.txt/download/").status_code, 404)
        self.assertEqual(self._as(self.admin).get(
            "/api/v1/ops/backups/4sogh_2026-11-01_0315.dump/download/").status_code, 403)

    def test_logs_are_redacted(self):
        os.makedirs(os.path.join(self.data.name, "logs"))
        with open(os.path.join(self.data.name, "logs", "backend.log"), "w") as fh:
            fh.write("Authorization: Bearer abc.def.ghi user 09123456789 ok\n")
        r = self._as(self.admin).get("/api/v1/ops/logs/")
        line = r.data["lines"][0]
        self.assertNotIn("abc.def.ghi", line)
        self.assertNotIn("09123456789", line)
