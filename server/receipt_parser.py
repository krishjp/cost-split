import os
import sys
import json
import time
import google.generativeai as genai
from dotenv import load_dotenv
from PIL import Image
import pillow_heif

# Register HEIC opener
pillow_heif.register_heif_opener()

# Load environment variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    # Try to find it in the parent directory .env if not found in current dir
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
    api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print(json.dumps({"error": "GEMINI_API_KEY not found in environment"}))
    sys.exit(1)

genai.configure(api_key=api_key)


def check_rate_limit():
    """Simple file-based rate limiter for the CLI tool."""
    limit_file = os.path.join(os.path.dirname(__file__), ".rate_limit")
    max_requests_per_minute = 10
    now = time.time()

    try:
        if os.path.exists(limit_file):
            with open(limit_file, "r") as f:
                data = json.load(f)
                last_requests = data.get("requests", [])
                # Keep only requests from the last 60 seconds
                last_requests = [t for t in last_requests if now - t < 60]
                if len(last_requests) >= max_requests_per_minute:
                    return False, len(last_requests)
                last_requests.append(now)
        else:
            last_requests = [now]

        with open(limit_file, "w") as f:
            json.dump({"requests": last_requests}, f)
        return True, len(last_requests)
    except Exception:
        # If rate limiting fails (e.g. file permissions), allow but log (or just allow for simplicity)
        return True, 0


def validate_items(items):
    """Ensure the LLM output conforms to the expected structure."""
    if not isinstance(items, list):
        raise ValueError("Output must be a JSON array")

    validated = []
    for item in items:
        if not isinstance(item, dict):
            continue

        name = str(item.get("name", "Unknown Item"))
        try:
            price = float(item.get("price", 0))
        except (ValueError, TypeError):
            price = 0.0

        try:
            quantity = int(item.get("quantity", 1))
        except (ValueError, TypeError):
            quantity = 1

        validated.append({"name": name, "price": price, "quantity": quantity})
    return validated


def parse_receipt(image_path):
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")

        img = Image.open(image_path)

        prompt = """
        You are a generic receipt parser. Your goal is to extract a list of purchased items from the image.
        
        CRITICAL RULES FOR PRICING:
        1.  **Line Alignment**: The price for an item is almost always on the same line (or immediately following) the item name. 
        2.  **Do NOT Shift**: Do not assign the price of Item B to Item A. 
        3.  **Stop at Subtotal**: The moment you see "Subtotal", "Tax", or "Total", STOP parsing items. Do NOT use the Subtotal value as a price for the last item.
        
        Extraction Rules:
        - name: string (The item description. Include modifiers/add-ons like "Add Chicken" in parentheses).
        - price: number (The UNIT PRICE for a single item. If the receipt shows a total line price for multiple items, DIVIDE the total by the quantity to get the unit price. e.g., if "2 Ramen ... 30.00", the price should be 15.00). 
            If there are add-on costs involved, sum them up mentally if they aren't separate line items.
        - quantity: number (Look for a leading number like "2 Ramen". Default to 1).
        
        Structure:
        Return ONLY a raw JSON array. No markdown.
        
        Example expected behavior:
        Receipt:
        "3 Sm Ramen   45.00"
        "  * Chicken"
        "  * #3"
        "1 R Ramen    17.00"
        "  * Tofu"
        "  * #3"
        "Subtotal     62.00"
        
        Output:
        [
            {"name": "Sm Ramen (Chicken)", "price": 15.00, "quantity": 3},
            {"name": "R Ramen (Tofu)", "price": 17.00, "quantity": 1}
        ]
        """

        # Validate rate limit
        allowed, count = check_rate_limit()
        if not allowed:
            print(
                json.dumps(
                    {"error": "Rate limit exceeded. Max 10 requests per minute."}
                )
            )
            sys.exit(1)

        response = model.generate_content([prompt, img])

        # Clean response text just in case model adds backticks
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        # Validate JSON
        try:
            items = json.loads(text)
            validated_items = validate_items(items)
            print(json.dumps(validated_items))
        except json.JSONDecodeError:
            print(json.dumps({"error": "LLM returned invalid JSON"}))
            sys.exit(1)
        except ValueError as ve:
            print(json.dumps({"error": str(ve)}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]
    parse_receipt(image_path)
