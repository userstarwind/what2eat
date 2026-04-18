from fastapi import HTTPException, status


class RecommendationHTTPException(HTTPException):
    pass


class NotEnoughRecommendationCandidatesException(RecommendationHTTPException):
    def __init__(self, *, minimum: int, actual: int) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Candidate food pool is too small for recommendation. "
                f"Need at least {minimum} foods, but only found {actual}."
            ),
        )
