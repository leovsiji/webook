
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.contrib.auth.hashers import check_password, make_password

from database.models import Book


@login_required
@require_POST
def publish_book(request, book_id):
    book = get_object_or_404(Book, id=book_id, owner=request.user)

    action = request.POST.get("action")

    if action == "publish":
        book.status = True

    elif action == "unpublish":
        book.status = False

    else:
        return redirect("book_pages", book_id=book.id)

    book.save()

    return redirect("book_pages", book_id=book.id)


def unlock_book(request, slug):
    book = get_object_or_404(
        Book,
        slug=slug,
        status=True
    )

    if request.method == "POST":
        entered_passcode = request.POST.get("passcode", "")

        valid = check_password(entered_passcode, book.passcode)

        if not valid and entered_passcode == book.passcode:
            book.passcode = make_password(entered_passcode)
            book.save()
            valid = True

        if valid:
            request.session.cycle_key()
            request.session[f"webook_unlocked_{book.id}"] = True

            return redirect("receiver:read", slug=book.slug)

        return render(request, "receiver/unlock.html", {
            "book": book,
            "error": "Incorrect passcode."
        })

    return render(request, "receiver/unlock.html", {
        "book": book
    })


def read_book(request, slug):
    book = get_object_or_404(
        Book,
        slug=slug,
        status=True
    )

    if not request.session.get(f"webook_unlocked_{book.id}"):
        return redirect("receiver:unlock", slug=book.slug)

    pages = book.pages.prefetch_related("photos").order_by("order")

    return render(request, "receiver/read.html", {
        "book": book,
        "pages": pages
    })
