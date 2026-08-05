import re
from datetime import datetime
from typing import Optional


def normalize_date(value: Optional[str]) -> Optional[str]:
    """Normalize date to YYYY-MM-DD format, handling multiple input formats."""
    if not value:
        return None

    value = value.strip()

    formats = [
        "%Y-%m-%d",
        "%d.%m.%Y",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%m/%d/%Y",
        "%m-%d-%Y",
        "%m.%d.%Y"
    ]

    for fmt in formats:
        try:
            date = datetime.strptime(value, fmt)
            return date.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return value.lower()


def normalize_cnic(value: Optional[str]) -> Optional[str]:
    """Normalize CNIC by removing all non-digit characters."""
    if not value:
        return None

    return "".join(char for char in value if char.isdigit())


def normalize_gender(value: Optional[str]) -> Optional[str]:
    """Normalize gender to standard 'male' or 'female' format."""
    if not value:
        return None

    value = value.strip().lower()

    mapping = {
        "m": "male",
        "male": "male",
        "man": "male",
        "f": "female",
        "female": "female",
        "woman": "female"
    }

    return mapping.get(value, value)


def normalize_name(value: Optional[str]) -> Optional[str]:
    """Normalize name by lowercasing, removing punctuation and extra whitespace."""
    if not value:
        return None

    value = value.lower().strip()
    value = re.sub(r"[^\w\s]", "", value)
    value = " ".join(value.split())

    return value


def normalize_field(field_name: str, value: Optional[str]) -> Optional[str]:
    """Normalize a field value based on its field type."""
    if not value:
        return None

    if field_name in ["date_of_birth", "issue_date", "expiry_date"]:
        return normalize_date(value)
    elif field_name == "cnic" or field_name == "cnic_number":
        return normalize_cnic(value)
    elif field_name == "gender":
        return normalize_gender(value)
    elif field_name in ["full_name", "father_name"]:
        return normalize_name(value)
    else:
        return value.strip().lower()


def compare_field(field_name: str, form_value: Optional[str], document_value: Optional[str]) -> bool:
    """Compare two field values after normalization."""
    normalized_form = normalize_field(field_name, form_value)
    normalized_doc = normalize_field(field_name, document_value)

    if normalized_form is None and normalized_doc is None:
        return True
    if normalized_form is None or normalized_doc is None:
        return False

    # For names, use fuzzy matching to handle partial matches
    if field_name in ["full_name", "father_name"]:
        # Check if one name is contained in the other (handles partial names)
        if normalized_form in normalized_doc or normalized_doc in normalized_form:
            return True

        # Check word overlap (at least 50% of words match)
        form_words = set(normalized_form.split())
        doc_words = set(normalized_doc.split())

        if form_words and doc_words:
            overlap = len(form_words & doc_words)
            max_words = max(len(form_words), len(doc_words))
            if overlap / max_words >= 0.5:
                return True

    return normalized_form == normalized_doc
