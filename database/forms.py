from django import forms
from .models import Photo


class PhotoForm(forms.ModelForm):

    class Meta:
        model = Photo
        fields = ["image", "caption"]

    def clean_image(self):
        image = self.cleaned_data.get("image")

        if image and image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Image size cannot exceed 5 MB.")

        return image

class MusicForm(forms.Form):
    music = forms.FileField()

    def clean_music(self):
        music = self.cleaned_data["music"]

        allowed_extensions = [".mp3", ".wav", ".ogg", ".m4a"]
        extension = music.name.lower().rsplit(".", 1)[-1]

        if extension not in [ext.lstrip(".") for ext in allowed_extensions]:
            raise forms.ValidationError("Only MP3, WAV, OGG and M4A files are allowed.")

        if music.size > 15 * 1024 * 1024:
            raise forms.ValidationError("Music file cannot exceed 15 MB.")

        return music