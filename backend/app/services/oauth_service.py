"""OAuth 2.0 / OIDC service for Google and Microsoft login."""
import httpx
from typing import Optional
from app.config import settings


PROVIDERS = {
    "google": {
        "client_id": None,  # loaded lazily from settings
        "client_secret": None,
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
    },
    "microsoft": {
        "client_id": None,
        "client_secret": None,
        "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/oidc/userinfo",
        "scope": "openid email profile",
    },
}


class OAuthService:
    def _get_provider(self, provider: str) -> dict:
        if provider not in PROVIDERS:
            raise ValueError(f"Unknown provider: {provider}")
        cfg = dict(PROVIDERS[provider])
        if provider == "google":
            cfg["client_id"] = settings.GOOGLE_CLIENT_ID
            cfg["client_secret"] = settings.GOOGLE_CLIENT_SECRET
        elif provider == "microsoft":
            cfg["client_id"] = settings.MICROSOFT_CLIENT_ID
            cfg["client_secret"] = settings.MICROSOFT_CLIENT_SECRET
        return cfg

    def is_configured(self, provider: str) -> bool:
        """Return True if the OAuth app credentials are present for the provider."""
        cfg = self._get_provider(provider)
        return bool(cfg.get("client_id") and cfg.get("client_secret"))

    def get_authorization_url(self, provider: str, redirect_uri: str, state: str) -> str:
        """Return the full OAuth authorization URL to redirect the user to."""
        cfg = self._get_provider(provider)
        params = {
            "client_id": cfg["client_id"],
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": cfg["scope"],
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
        }
        if not cfg.get("client_id"):
            raise ValueError(f"OAuth not configured for provider '{provider}'. "
                             f"Set {provider.upper()}_CLIENT_ID and {provider.upper()}_CLIENT_SECRET.")
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{cfg['auth_url']}?{query}"

    async def fetch_user_info(
        self, provider: str, code: str, redirect_uri: str
    ) -> dict:
        """Exchange auth code for tokens and fetch user profile from IdP."""
        cfg = self._get_provider(provider)

        async with httpx.AsyncClient(timeout=15) as client:
            # Exchange code for tokens
            token_resp = await client.post(
                cfg["token_url"],
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": cfg["client_id"],
                    "client_secret": cfg["client_secret"],
                },
                headers={"Accept": "application/json"},
            )
            token_resp.raise_for_status()
            tokens = token_resp.json()
            access_token = tokens.get("access_token")

            # Fetch user info
            userinfo_resp = await client.get(
                cfg["userinfo_url"],
                headers={"Authorization": f"Bearer {access_token}"},
            )
            userinfo_resp.raise_for_status()
            info = userinfo_resp.json()

        # Normalize user info across providers
        email = info.get("email") or info.get("mail") or info.get("preferred_username", "")
        name = info.get("name") or f"{info.get('given_name', '')} {info.get('family_name', '')}".strip()
        sso_id = info.get("sub") or info.get("id") or email

        return {
            "email": email,
            "name": name,
            "sso_id": sso_id,
            "sso_provider": provider,
        }
