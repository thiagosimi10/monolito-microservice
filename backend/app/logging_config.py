import logging


def configure_logging() -> None:
    """Basic, human-readable logging for the monolith."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )
