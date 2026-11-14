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