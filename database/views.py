from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
from django.contrib.auth.hashers import make_password
from django.utils.text import slugify
from django.views.decorators.http import require_POST
from .models import Book, Page, Photo
from .forms import PhotoForm

def user_login(request):
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect("create_book")

        return render(request, "login.html", {"error": "Invalid username or password"})

    return render(request, "login.html")



def register(request):
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")

        User.objects.create_user(
            username=username,
            password=password
        )

        return redirect("login")

    return render(request, "register.html")

@login_required
@login_required
def create_book(request):
    if request.method == "POST":
        title = request.POST.get("title", "").strip()
        description = request.POST.get("description", "")
        passcode = request.POST.get("passcode", "").strip()

        if not title or not passcode:
            return render(request, "create_book.html", {
                "error": "Title and passcode are required."
            })

        slug = slugify(title)

        if Book.objects.filter(slug=slug).exists():
            return render(request, "create_book.html", {
                "error": "A book with this title already exists. Choose another title."
            })

        book = Book.objects.create(
            owner=request.user,
            title=title,
            description=description,
            slug=slug,
            passcode=make_password(passcode)
        )

        return render(request, "book_created.html", {"book": book})

    return render(request, "create_book.html")

@login_required
def create_page(request,book_id):
    book = get_object_or_404(Book,id=book_id, owner=request.user)
    if request.method == "POST":
        title = request.POST.get("title")
        content = request.POST.get("content")

        last_page=book.pages.order_by("-order").first()
        order  = last_page.order+1 if last_page else 1

        page = Page.objects.create(
            book = book,
            title = title,
            content = content,
            order = order
        )
        return render(request,"page_create.html",{"page":page})
    return render(request,"create_page.html",{"book":book})

@login_required
def book_pages(request,book_id):
    book = get_object_or_404(Book,id=book_id, owner = request.user)
    pages = book.pages.all()

    return render(request, "book_pages.html",{
        "book": book,
        "pages": pages 
    })

@login_required
@require_POST
def delete_page(request, page_id):
    page = get_object_or_404(
        Page,
        id=page_id,
        book__owner=request.user
    )

    book_id = page.book.id
    page.delete()

    return redirect("book_pages", book_id=book_id)

@login_required
def delete_book(request,book_id):
    book = get_object_or_404(Book,id=book_id, owner=request.user)

    book.delete()
    return redirect("create_book")

@login_required
def edit_page(request, page_id):
    page = get_object_or_404(
        Page,
        id=page_id,
        book__owner=request.user
    )

    if request.method == "POST":
        page.title = request.POST.get("title", "")
        page.content = request.POST.get("content", "")
        page.save()

        return redirect("book_pages", book_id=page.book.id)

    return render(request, "edit_page.html", {"page": page})

@login_required
def edit_book(request, book_id):
    book = get_object_or_404(Book,id=book_id, owner=request.user)

    if request.method == "POST":
        book.title = request.POST.get("title")
        book.description = request.POST.get("description")
        new_passcode = request.POST.get("passcode")
        if new_passcode:
            book.passcode = make_password(new_passcode)
        book.save()

        return redirect("book_pages", book_id=book.id)

    return render(request, "edit_book.html", {"book": book})

@login_required
def my_books(request):
    books = Book.objects.filter(owner=request.user)

    return render(request, "my_books.html", {
        "books": books
    })

@login_required
def add_photo(request, page_id):
    page = get_object_or_404(
        Page,
        id=page_id,
        book__owner=request.user
    )

    form = PhotoForm(request.POST or None, request.FILES or None)

    if request.method == "POST" and form.is_valid():
        photo = form.save(commit=False)
        photo.page = page

        last_photo = page.photos.order_by("-order").first()
        photo.order = last_photo.order + 1 if last_photo else 1

        photo.save()

        return redirect("book_pages", book_id=page.book.id)

    return render(request, "add_photo.html", {
        "page": page,
        "form": form
    })

@login_required
@require_POST
def delete_photo(request, photo_id):
    photo = get_object_or_404(
        Photo,
        id=photo_id,
        page__book__owner=request.user
    )  

    book_id = photo.page.book.id
    photo.delete()

    return redirect("book_pages", book_id=book_id)

def reader(request, slug):
    book = get_object_or_404(Book, slug=slug)
    unlocked = request.session.get("unlocked_books", [])
    is_owner = request.user.is_authenticated and book.owner_id == request.user.id

    if not is_owner and book.id not in unlocked:
        if request.method == "POST":
            if request.POST.get("passcode") == book.passcode:
                request.session["unlocked_books"] = unlocked + [book.id]
                return redirect("reader", slug=slug)
            return render(request, "reader.html", {
                "book": book, "locked": True,
                "error": "That passcode doesn't match. Try again.",
            })
        return render(request, "reader.html", {"book": book, "locked": True})

    pages = book.pages.order_by("order").prefetch_related("photos")
    return render(request, "reader.html", {"book": book, "pages": pages})