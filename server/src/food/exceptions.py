from fastapi import HTTPException, status


class FoodHTTPException(HTTPException):
    pass


class FoodNotFoundException(FoodHTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food not found.",
        )


class FoodAlreadyExistsException(FoodHTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Food with the same name already exists.",
        )


class InvalidDefaultFoodDataException(FoodHTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default food data is invalid.",
        )
