import requests


class MoodleClient:
    """
    Wraps the Moodle REST web-service protocol
    (server.php?wstoken=...&wsfunction=...&moodlewsrestformat=json).

    Site prerequisites: web services + REST protocol enabled, and a token
    scoped to at least: core_webservice_get_site_info, core_course_get_courses.
    """

    def __init__(self, base_url, token, timeout=15):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self.endpoint = f"{self.base_url}/webservice/rest/server.php"

    def _call(self, wsfunction, params=None):
        payload = {"wstoken": self.token, "wsfunction": wsfunction, "moodlewsrestformat": "json"}
        payload.update(params or {})
        try:
            r = requests.post(self.endpoint, data=payload, timeout=self.timeout)
            r.raise_for_status()
            result = r.json()
        except requests.RequestException as exc:
            return {"ok": False, "error": f"Connection error: {exc}"}
        except ValueError:
            return {"ok": False, "error": "Moodle returned a non-JSON response."}
        if isinstance(result, dict) and result.get("exception"):
            return {"ok": False, "error": result.get("message", "Moodle API error")}
        return {"ok": True, "data": result}

    def test_connection(self):
        result = self._call("core_webservice_get_site_info")
        if not result["ok"]:
            return result
        info = result["data"]
        return {"ok": True, "site_name": info.get("sitename"),
                "username": info.get("username"), "moodle_version": info.get("release")}

    def get_courses(self):
        result = self._call("core_course_get_courses")
        if not result["ok"]:
            return result
        courses = [{"id": c["id"], "shortname": c.get("shortname"), "fullname": c.get("fullname")}
                   for c in result["data"] if c.get("id") != 1]
        return {"ok": True, "courses": courses}

    def upload_gift_to_course(self, course_id, gift_text, filename="export.gift"):
        """Uploads the GIFT file to the teacher's Moodle private files draft
        area. Finishing the import (Question bank > Import > GIFT format)
        is a manual last click — Moodle core has no webservice for it."""
        upload_url = f"{self.base_url}/webservice/upload.php"
        files = {"file_1": (filename, gift_text.encode("utf-8"), "text/plain")}
        data = {"token": self.token}
        try:
            r = requests.post(upload_url, data=data, files=files, timeout=self.timeout)
            r.raise_for_status()
            result = r.json()
        except requests.RequestException as exc:
            return {"ok": False, "error": f"Upload failed: {exc}"}
        except ValueError:
            return {"ok": False, "error": "Moodle returned a non-JSON response on upload."}
        if isinstance(result, dict) and result.get("exception"):
            return {"ok": False, "error": result.get("message", "Upload error")}
        return {"ok": True, "message": "GIFT file uploaded to your Moodle private files. "
                                        "Finish the import from Question bank > Import > GIFT format.",
                "upload_result": result}