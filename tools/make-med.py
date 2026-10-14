# Writes 2048px "-med" diffuse sheets next to the 4096px bakes (grid/footer quality tier).
import glob, os
from PIL import Image
for f in glob.glob('public/assets/mv/*_diffuse.jpg'):
    im = Image.open(f); im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(f.replace('_diffuse.jpg', '_diffuse-med.jpg'), quality=88, optimize=True)
    print(f, os.path.getsize(f)//1024, 'KB')
