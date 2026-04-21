from fastapi import HTTPException, status


class RecommendationHistoryHTTPException(HTTPException):
    pass


class RecommendationHistoryNotFoundException(RecommendationHistoryHTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation history not found.",
        )
