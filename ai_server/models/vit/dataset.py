from PIL import Image
from torchvision import transforms

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor()
])

def load_image(image_path):
    image = Image.open(image_path).convert("RGB")
    return transform(image)