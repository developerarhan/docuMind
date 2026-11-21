import re


def validate_source_citations(answer: str, sources: list):
    """
    Validate citations in an AI-generated answer against retrieved sources.

    Returns citation validation results.
    """
    citations = re.findall(
        r"\[Source\s+(\d+)\]",
        answer,
        flags=re.IGNORECASE
    )

    cited_ids = set(map(int, citations))

    valid_source_ids = {
        source["source_id"]
        for source in sources
        if isinstance(source.get("source_id"), int)
        and not isinstance(source.get("source_id"), bool)
    }

    invalid_citations = cited_ids - valid_source_ids

    valid_citations = cited_ids & valid_source_ids

    return {
        "is_valid": len(invalid_citations) == 0,
        "has_citations": bool(cited_ids),
        "valid_citations": sorted(valid_citations),
        "invalid_citations": sorted(invalid_citations)
    }
