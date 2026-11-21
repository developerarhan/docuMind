from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

User = get_user_model()


class UserRegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_registration_success_returns_token_and_user_data(self):
        payload = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "password_confirm": "SecurePassword123!",
        }
        response = self.client.post("/api/auth/register/", data=payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["username"], "newuser")
        self.assertEqual(response.data["user"]["email"], "newuser@example.com")

        # Verify database record
        user = User.objects.get(username="newuser")
        self.assertTrue(user.check_password("SecurePassword123!"))

        # Verify token in DB matches response
        token = Token.objects.get(user=user)
        self.assertEqual(response.data["token"], token.key)

    def test_registration_password_mismatch_rejected(self):
        payload = {
            "username": "mismatchuser",
            "email": "mismatch@example.com",
            "password": "Password123!",
            "password_confirm": "DifferentPassword456!",
        }
        response = self.client.post("/api/auth/register/", data=payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("password_confirm", response.data)
        self.assertFalse(User.objects.filter(username="mismatchuser").exists())

    def test_registration_duplicate_username_rejected(self):
        User.objects.create_user(username="existinguser", password="password123")

        payload = {
            "username": "existinguser",
            "password": "Password123!",
            "password_confirm": "Password123!",
        }
        response = self.client.post("/api/auth/register/", data=payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.data)

    def test_registration_short_password_rejected(self):
        payload = {
            "username": "shortpassuser",
            "password": "123",
            "password_confirm": "123",
        }
        response = self.client.post("/api/auth/register/", data=payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)


class UserLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            password="CorrectPassword123!",
        )

    def test_login_success_returns_token(self):
        payload = {
            "username": "testuser",
            "password": "CorrectPassword123!",
        }
        response = self.client.post("/api/auth/login/", data=payload, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["username"], "testuser")

        # Verify token exists and is valid
        token = Token.objects.get(user=self.user)
        self.assertEqual(response.data["token"], token.key)

    def test_login_invalid_password_rejected(self):
        payload = {
            "username": "testuser",
            "password": "WrongPassword999!",
        }
        response = self.client.post("/api/auth/login/", data=payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid username or password", str(response.data))

    def test_login_nonexistent_user_rejected(self):
        payload = {
            "username": "ghostuser",
            "password": "AnyPassword123!",
        }
        response = self.client.post("/api/auth/login/", data=payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid username or password", str(response.data))


class TokenAuthenticationFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="tokenuser",
            email="tokenuser@example.com",
            password="Password123!",
        )
        self.token = Token.objects.create(user=self.user)

    def test_access_protected_endpoint_with_valid_token(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "tokenuser")
        self.assertEqual(response.data["email"], "tokenuser@example.com")

    def test_access_protected_endpoint_with_invalid_token_fails(self):
        self.client.credentials(HTTP_AUTHORIZATION="Token invalid_fake_token_12345")
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 401)

    def test_access_protected_endpoint_without_token_fails(self):
        response = self.client.get("/api/auth/me/")
        self.assertIn(response.status_code, [401, 403])

    def test_logout_invalidates_token(self):
        # Authenticate with token
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        # Call logout
        response = self.client.post("/api/auth/logout/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Logged out successfully", response.data["message"])

        # Verify token was removed from database
        self.assertFalse(Token.objects.filter(key=self.token.key).exists())

        # Verify subsequent requests with the old token are rejected
        subsequent_response = self.client.get("/api/auth/me/")
        self.assertEqual(subsequent_response.status_code, 401)
