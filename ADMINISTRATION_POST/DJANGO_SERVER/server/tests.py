from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Compagnie, Person, Rentree, Spectacle


class RentreeFilterTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.comp_a = Compagnie.objects.create(label="A")
        comp_b = Compagnie.objects.create(label="B")
        for i, (comp, late) in enumerate([(self.comp_a, True), (self.comp_a, False), (comp_b, True)]):
            person = Person.objects.create(mat=f"M{i}", nom="N", prenom="P", compagnie=comp)
            spectacle = Spectacle.objects.create(person=person, date_sortie=now - timedelta(days=1), date_rentree=now)
            Rentree.objects.create(person=person, spectacle=spectacle, date_rentree=now, est_retard=late)

        admin = get_user_model().objects.create_user("admin", password="x", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(admin)

    def ids(self, query):
        response = self.client.get(f"/api/rentrees/{query}")
        self.assertEqual(response.status_code, 200)
        return sorted(r["person"]["mat"] for r in response.json()["results"])

    def test_late_and_company_filters_combine(self):
        self.assertEqual(self.ids(""), ["M0", "M1", "M2"])
        self.assertEqual(self.ids("?est_retard=true"), ["M0", "M2"])
        self.assertEqual(self.ids(f"?compagnie={self.comp_a.id}"), ["M0", "M1"])
        self.assertEqual(self.ids(f"?compagnie={self.comp_a.id}&est_retard=true"), ["M0"])

    def test_bad_company_param_is_ignored(self):
        self.assertEqual(self.ids("?compagnie=abc"), ["M0", "M1", "M2"])


class SpectacleDateValidationTests(TestCase):
    """Dates that break Spectacle's CheckConstraints must give 400, never a 500 IntegrityError."""

    def setUp(self):
        self.now = timezone.now()
        comp = Compagnie.objects.create(label="A")
        self.person = Person.objects.create(mat="M1", nom="N", prenom="P", compagnie=comp)
        self.spectacle = Spectacle.objects.create(person=self.person, date_sortie=self.now)
        admin = get_user_model().objects.create_user("admin", password="x", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(admin)

    def test_create_with_deadline_before_departure(self):
        response = self.client.post("/api/spectacles/", {
            "person_id": self.person.id,
            "date_sortie": self.now.isoformat(),
            "date_limite_retour": (self.now - timedelta(hours=1)).isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("date_limite_retour", response.json())

    def test_partial_update_checks_against_stored_departure(self):
        response = self.client.patch(f"/api/spectacles/{self.spectacle.id}/", {
            "date_limite_retour": (self.now - timedelta(hours=1)).isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_mark_return_before_departure(self):
        response = self.client.post(f"/api/spectacles/{self.spectacle.id}/mark_return/", {
            "date_rentree": (self.now - timedelta(days=1)).isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Rentree.objects.exists())

    def test_excel_import_skips_bad_row_and_keeps_good_ones(self):
        import io

        import pandas as pd
        from django.core.files.uploadedfile import SimpleUploadedFile

        buffer = io.BytesIO()
        pd.DataFrame({
            "mat": ["M1", "M1"],
            "date_sortie": ["2026-03-05 08:00", "2026-03-05 08:00"],
            "date_limite_retour": ["2026-03-05 18:00", "2026-03-04 18:00"],  # 2nd row: deadline before departure
        }).to_excel(buffer, index=False)
        upload = SimpleUploadedFile("Sortie.xlsx", buffer.getvalue())

        response = self.client.post("/api/spectacles/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["created_count"], 1)
        self.assertEqual(body["error_count"], 1)
        self.assertIn("Row 3", body["errors"][0])


class RentreeEditTests(TestCase):
    def setUp(self):
        now = timezone.now()
        comp = Compagnie.objects.create(label="A")
        self.person = Person.objects.create(mat="M1", nom="N", prenom="P", compagnie=comp)
        # deadline already passed when the person came back -> late
        self.spectacle = Spectacle.objects.create(
            person=self.person, date_sortie=now - timedelta(days=2),
            date_limite_retour=now - timedelta(days=1), date_rentree=now,
        )
        self.rentree = Rentree.objects.create(person=self.person, spectacle=self.spectacle, date_rentree=now, est_retard=True)
        admin = get_user_model().objects.create_user("admin", password="x", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(admin)

    def test_patch_without_spectacle_keeps_late_flag(self):
        response = self.client.patch(f"/api/rentrees/{self.rentree.id}/", {
            "date_rentree": timezone.now().isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.rentree.refresh_from_db()
        self.assertTrue(self.rentree.est_retard)

    def test_second_return_for_same_spectacle_is_400(self):
        response = self.client.post("/api/rentrees/", {
            "person_id": self.person.id,
            "spectacle_id": self.spectacle.id,
            "date_rentree": timezone.now().isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("spectacle_id", response.json())

    def test_delete_reopens_spectacle(self):
        response = self.client.delete(f"/api/rentrees/{self.rentree.id}/")
        self.assertEqual(response.status_code, 204)
        self.spectacle.refresh_from_db()
        self.assertIsNone(self.spectacle.date_rentree)

    def test_moving_return_reopens_old_spectacle(self):
        other = Spectacle.objects.create(person=self.person, date_sortie=timezone.now() - timedelta(hours=1))
        response = self.client.patch(f"/api/rentrees/{self.rentree.id}/", {"spectacle_id": other.id}, format="json")
        self.assertEqual(response.status_code, 200)
        self.spectacle.refresh_from_db()
        other.refresh_from_db()
        self.assertIsNone(self.spectacle.date_rentree)
        self.assertIsNotNone(other.date_rentree)


class SpectacleExcelImportTests(TestCase):
    def setUp(self):
        comp = Compagnie.objects.create(label="A")
        self.person = Person.objects.create(mat="00123", nom="N", prenom="P", compagnie=comp)
        admin = get_user_model().objects.create_user("admin", password="x", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(admin)

    def upload(self, rows):
        import io

        import pandas as pd
        from django.core.files.uploadedfile import SimpleUploadedFile

        buffer = io.BytesIO()
        pd.DataFrame(rows).to_excel(buffer, index=False)
        return self.client.post("/api/spectacles/", {"file": SimpleUploadedFile("S.xlsx", buffer.getvalue())}, format="multipart")

    def test_leading_zero_mat_french_dates_and_returned_rows(self):
        response = self.upload({
            "mat": ["00123"],
            "date_sortie": ["05/03/2026 08:00"],          # 5 March, not 3 May
            "date_limite_retour": ["05/03/2026 18:00"],
            "date_rentree": ["2026-03-05 20:00"],          # ISO must not be day/month-swapped
        })
        self.assertEqual(response.status_code, 201, response.json())
        spectacle = Spectacle.objects.get()
        self.assertEqual((spectacle.date_sortie.month, spectacle.date_sortie.day), (3, 5))
        self.assertEqual((spectacle.date_rentree.month, spectacle.date_rentree.day), (3, 5))
        rentree = Rentree.objects.get(spectacle=spectacle)
        self.assertTrue(rentree.est_retard)

    def test_mark_return_with_non_string_date_is_400(self):
        spectacle = Spectacle.objects.create(person=self.person, date_sortie=timezone.now())
        response = self.client.post(f"/api/spectacles/{spectacle.id}/mark_return/", {"date_rentree": ["x"]}, format="json")
        self.assertEqual(response.status_code, 400)


class SpectacleEligibilityTests(TestCase):
    def setUp(self):
        from server.services import recongnition

        self.rec = recongnition
        comp = Compagnie.objects.create(label="A")
        self.person = Person.objects.create(mat="M1", nom="N", prenom="P", compagnie=comp)

    def test_return_then_still_shows_returned(self):
        Spectacle.objects.create(person=self.person, date_sortie=timezone.now() - timedelta(hours=1))
        eligible, info, _ = self.rec.check_spectacle_eligibility("M1", mark_return=True)
        self.assertTrue(eligible)
        self.assertEqual(info["status"], "RETURNED - ON TIME")
        # next processed frame, same person still in view
        eligible, info, _ = self.rec.check_spectacle_eligibility("M1", mark_return=True)
        self.assertTrue(eligible)
        self.assertEqual(info["status"], "RETURNED - ON TIME")
        self.assertEqual(Rentree.objects.count(), 1)

    def test_future_spectacle_is_not_closed(self):
        future = Spectacle.objects.create(person=self.person, date_sortie=timezone.now() + timedelta(days=1))
        eligible, info, _ = self.rec.check_spectacle_eligibility("M1", mark_return=True)
        self.assertFalse(eligible)
        self.assertEqual(info["status"], "NOT ON SPECTACLE")
        future.refresh_from_db()
        self.assertIsNone(future.date_rentree)


class VideoStreamLifecycleTests(TestCase):
    """Concurrency of the shared stream processor, driven directly with a fake processor."""

    def setUp(self):
        import asyncio
        import threading
        import types
        from unittest import mock

        import numpy as np

        from server import consumers

        self.Consumer = consumers.VideoStreamConsumer
        self.Consumer.stream_processor = None
        self.Consumer.streaming_task = None
        self.Consumer.connected_clients = set()
        self.Consumer.lifecycle_lock = asyncio.Lock()
        self.init_calls = 0

        async def fake_init(consumer):
            self.init_calls += 1
            await asyncio.sleep(0.05)  # camera open takes time: the race window
            self.Consumer.stream_processor = types.SimpleNamespace(
                state_lock=threading.Lock(), rendered_frame=np.zeros((4, 4, 3), np.uint8),
                rendered_seq=1, latest_boxes=[], latest_error="", stop=lambda: None,
            )
            return True

        self.patches = [
            mock.patch.object(self.Consumer, "_initialize_stream_processor", fake_init),
            mock.patch.object(self.Consumer, "accept", mock.AsyncMock()),
            mock.patch.object(self.Consumer, "send_json", mock.AsyncMock()),
            mock.patch.object(self.Consumer, "stream_video", mock.AsyncMock()),
            mock.patch.object(consumers, "database_sync_to_async", lambda f: mock.AsyncMock(return_value="admin")),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def make(self):
        consumer = self.Consumer.__new__(self.Consumer)
        consumer.scope = {"user": None}
        return consumer

    def test_simultaneous_connects_start_one_processor(self):
        import asyncio

        async def run():
            await asyncio.gather(self.make().connect(), self.make().connect())

        asyncio.run(run())
        self.assertEqual(self.init_calls, 1)

    def test_refresh_keeps_a_processor(self):
        import asyncio

        async def run():
            first = self.make()
            await first.connect()
            # browser refresh: old socket closes while the new one connects
            await asyncio.gather(first.disconnect(1000), self.make().connect())

        asyncio.run(run())
        self.assertIsNotNone(self.Consumer.stream_processor)

    def test_stream_sends_only_new_frames(self):
        import asyncio
        from unittest import mock

        self.patches[3].stop()  # use the real stream_video
        self.patches.pop(3)

        async def run():
            consumer = self.make()
            await consumer.connect()  # starts the real streaming task
            self.Consumer.SEND_EVERY_N_FRAMES = 1
            with mock.patch.object(self.Consumer, "broadcast_to_all", mock.AsyncMock()) as broadcast,                     mock.patch.object(self.Consumer, "_format_detections", mock.AsyncMock(return_value=[])):
                await asyncio.sleep(0.2)  # same frame the whole time
                sent_while_idle = broadcast.await_count
                self.Consumer.stream_processor.rendered_seq += 1  # one new render
                await asyncio.sleep(0.2)
                sent_total = broadcast.await_count
            self.Consumer.connected_clients.clear()
            self.Consumer.streaming_task.cancel()
            return sent_while_idle, sent_total

        sent_while_idle, sent_total = asyncio.run(run())
        self.assertEqual((sent_while_idle, sent_total), (1, 2))


class CameraPingAllTests(TestCase):
    def test_slow_probe_does_not_hold_the_request_past_the_deadline(self):
        import time
        from unittest import mock

        from server import views
        from server.models import Camera

        fast = Camera.objects.create(ip_address="10.0.0.1", model_name="fast")
        slow = Camera.objects.create(ip_address="10.0.0.2", model_name="slow")

        def probe(camera):
            if camera.id == slow.id:
                time.sleep(2)  # unreachable camera
            return True, "rtsp://x"

        admin = get_user_model().objects.create_user("admin", password="x", is_staff=True)
        client = APIClient()
        client.force_authenticate(admin)
        with mock.patch.object(views, "_probe_camera", probe), mock.patch.object(views, "PING_ALL_TIMEOUT_SEC", 0.3):
            started = time.monotonic()
            response = client.get("/api/cameras/ping_all/")
            elapsed = time.monotonic() - started

        self.assertLess(elapsed, 1.0)
        body = response.json()
        self.assertTrue(body[str(fast.id)]["online"])
        self.assertFalse(body[str(slow.id)]["online"])


class SingleActiveCameraTests(TestCase):
    def test_activating_a_camera_deactivates_the_others(self):
        from server.models import Camera

        first = Camera.objects.create(ip_address="10.0.0.1", model_name="a", is_active=True)
        second = Camera.objects.create(ip_address="10.0.0.2", model_name="b", is_active=False)

        admin = get_user_model().objects.create_user("admin", password="x", is_staff=True)
        client = APIClient()
        client.force_authenticate(admin)
        response = client.post(f"/api/cameras/{second.id}/activate/")
        self.assertEqual(response.status_code, 200)

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertFalse(first.is_active)
        self.assertTrue(second.is_active)
        self.assertEqual(Camera.objects.filter(is_active=True).count(), 1)


class ProcessFrameTests(TestCase):
    """process_frame turns MODEL_SERVER detections into labelled boxes."""

    def setUp(self):
        comp = Compagnie.objects.create(label="A")
        person = Person.objects.create(mat="M1", nom="N", prenom="P", compagnie=comp)
        Spectacle.objects.create(person=person, date_sortie=timezone.now() - timedelta(hours=1))

    def test_matched_and_unmatched_faces(self):
        from unittest import mock

        import numpy as np

        from server.services import model_client, recongnition

        faces = [
            {"bbox": [10, 10, 50, 60], "person_id": "M1", "similarity": 0.8},
            {"bbox": [100, 10, 140, 60], "person_id": None, "similarity": 0.2},
        ]
        with mock.patch.object(model_client, "detect", return_value=faces):
            boxes = recongnition.process_frame(np.zeros((200, 200, 3), np.uint8), scale_x=2.0, scale_y=2.0)

        self.assertEqual(boxes[0]["box"], (20, 20, 80, 100))  # scaled back to the full frame
        self.assertTrue(boxes[0]["eligible"])
        self.assertEqual(boxes[0]["person_info"]["status"], "IN SPECTACLE")
        self.assertEqual(boxes[1]["label"], "No match")

    def test_model_server_down_raises(self):
        from unittest import mock

        import numpy as np
        import requests

        from server.services import model_client, recongnition

        with mock.patch.object(model_client._session, "post", side_effect=requests.ConnectionError("refused")):
            with self.assertRaises(model_client.ModelServerError):
                recongnition.process_frame(np.zeros((20, 20, 3), np.uint8))
