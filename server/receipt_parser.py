import os
import sys
import json
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
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
    api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print(json.dumps({"error": "GEMINI_API_KEY not found in environment"}))
    sys.exit(1)

genai.configure(api_key=api_key)

def parse_receipt(image_path):
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        img = Image.open(image_path)
        
        prompt = """
        You are a generic receipt parser. Your goal is to extract a list of purchased items from the image.
        
        CRITICAL RULES FOR PRICING:
        1.  **Line Alignment**: The price for an item is almost always on the same line (or immediately following) the item name. 
        2.  **Do NOT Shift**: Do not assign the price of Item B to Item A. 
        3.  **Stop at Subtotal**: The moment you see "Subtotal", "Tax", or "Total", STOP parsing items. Do NOT use the Subtotal value as a price for the last item.
        
        Extraction Rules:
        - name: string (The item description. Include modifiers/add-ons like "Add Chicken" in parentheses).
        - price: number (The final price for this line item. If there are add-on costs involved, sum them up mentally if they aren't separate line items. If the receipt lists "Small Ramen ... 15.00", the price is 15.00).
        - quantity: number (Look for a leading number like "2 Ramen". Default to 1).
        
        Structure:
        Return ONLY a raw JSON array. No markdown.
        
        Example expected behavior:
        Receipt:
        "1 Sm Ramen   15.00"
        "  * Chicken"
        "  * #3"
        "1 R Ramen    17.00"
        "  * Tofu"
        "  * #3"
        "Subtotal     32.00"
        
        Output:
        [
            {"name": "Sm Ramen (Chicken, #3)", "price": 15.00, "quantity": 1},
            {"name": "R Ramen", "price": 17.00, "quantity": 1}
        ]
        """
        
        response = model.generate_content([prompt, img])
        
        # Clean response text just in case model adds backticks
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        # Validate JSON
        items = json.loads(text)
        print(json.dumps(items))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    parse_receipt(image_path)
