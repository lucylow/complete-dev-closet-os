# Retail Partner API Framework & External Integrations

## 5. 🤝 Retail Partner API Framework

### 5.1 Overview  
Future B2B integrations with retail partners (e.g., Zara, H&M) would allow:

- Direct API access to product catalogs.  
- Real‑time inventory and pricing.  
- Affiliate commission tracking.

### 5.2 Generic Partner API Client  
```python  
class RetailPartnerAPI:  
    def __init__(self, partner_name: str, api_key: str, base_url: str):  
        self.partner = partner_name  
        self.api_key = api_key  
        self.base_url = base_url  
        self.session = requests.Session()  
        self.session.headers.update({"Authorization": f"Bearer {api_key}"})

    def search_products(self, query: str, category: str = None) -> list:  
        """Search partner catalog."""  
        endpoint = f"{self.base_url}/search"  
        params = {"q": query}  
        if category:  
            params["category"] = category  
        resp = self.session.get(endpoint, params=params, timeout=10)  
        resp.raise_for_status()  
        return resp.json().get("products", [])

    def get_product_details(self, product_id: str) -> dict:  
        endpoint = f"{self.base_url}/products/{product_id}"  
        resp = self.session.get(endpoint, timeout=10)  
        resp.raise_for_status()  
        return resp.json()  
```

### 5.3 Example: Zara Partner Integration (Hypothetical)  
```python  
class ZaraPartnerAPI(RetailPartnerAPI):  
    def __init__(self, api_key: str):  
        super().__init__("Zara", api_key, "https://api.zara.com/v1")

    def search_products(self, query: str, category: str = None) -> list:  
        products = super().search_products(query, category)  
        # Convert to common format  
        return [{  
            "title": p["name"],  
            "price": p["price"]["amount"],  
            "currency": p["price"]["currency"],  
            "link": p["url"],  
            "image": p["image"]["url"],  
            "partner": "Zara"  
        } for p in products]  
```

---

## 6. Environment Variables & Security

Store all secrets in Complete.dev environment variables:

- `OPENWEATHER_API_KEY`  
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`  
- `ENCRYPTION_KEY` (Fernet key, e.g., generated via `Fernet.generate_key()`)  
- `SERPAPI_KEY` or `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`, `AMAZON_PARTNER_TAG`

Never hard‑code keys. Use `os.environ.get()`.

### 6.1 Generating an Encryption Key  
```python  
from cryptography.fernet import Fernet  
key = Fernet.generate_key()  
print(key.decode())  # Store this as ENCRYPTION_KEY  
```

---

## 7. Testing & Error Handling

### 7.1 Unit Tests  
```python  
import pytest  
from unittest.mock import patch

def test_geocode_location():  
    with patch('requests.get') as mock_get:  
        mock_get.return_value.json.return_value = [{"lat": 40.7128, "lon": -74.0060}]  
        lat, lon = geocode_location("New York")  
        assert lat == 40.7128  
        assert lon == -74.0060  
```

### 7.2 Error Handling Best Practices  
- Always wrap API calls in try/except.  
- Return fallback values (e.g., default weather) rather than crashing.  
- Log errors for debugging.

```python  
def safe_fetch_weather(location: str) -> dict:  
    try:  
        return fetch_weather(location)  
    except Exception as e:  
        logging.error(f"Weather fetch failed: {e}")  
        return {"condition": "unknown", "temperature": 20, "precipitation": 0, "humidity": 50}  
```

---

## 8. Conclusion

These external integrations provide the real‑world data that makes CLOSET.OS intelligent and personalized. By following the code patterns above, you can reliably connect to OpenWeatherMap, Google Calendar, and shopping APIs, with a clear path to adding retail partners in the future.

All code is designed to be modular, secure, and easy to test within the Complete.dev environment.
