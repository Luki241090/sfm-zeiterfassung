import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

# Deine Objektliste für Wien
objekte = [
    {"id": "W-001", "name": "Bürokomplex Donau City", "addr": "Donau-City-Straße 7, 1220 Wien"},
    {"id": "W-002", "name": "Kanzlei am Ring", "addr": "Opernring 1, 1010 Wien"},
    {"id": "W-003", "name": "Wohnpark Alterlaa", "addr": "Anton-Baumgartner-Str. 44, 1230 Wien"},
    {"id": "W-004", "name": "MedCenter Nord", "addr": "Brünner Straße 131, 1210 Wien"},
    {"id": "W-005", "name": "Fitnessstudio West", "addr": "Hütteldorfer Str. 130, 1140 Wien"},
    {"id": "W-006", "name": "Schule Margareten", "addr": "Reinprechtsdorfer Str. 20, 1050 Wien"},
    {"id": "W-010", "name": "Palais Favoriten", "addr": "Favoritenstraße 15, 1040 Wien"}
]

def generate_qr_bundle(liste):
    output_dir = "qrcodes"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    for obj in liste:
        # Datenformat für die App: ID|NAME|ADRESSE
        data = f"{obj['id']}|{obj['name']}|{obj['addr']}"
        
        # QR Code erstellen
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
        
        # Beschriftung unter dem Code hinzufügen (für den Ausdruck)
        draw = ImageDraw.Draw(img)
        text = f"{obj['id']} - {obj['name']}"
        # Note: Using default font if custom font not found
        draw.text((10, img.size[1] - 30), text, fill="black")
        
        # Speichern
        filename = os.path.join(output_dir, f"QR_{obj['id']}.png")
        img.save(filename)
        print(f"Gespeichert: {filename}")

if __name__ == "__main__":
    generate_qr_bundle(objekte)
