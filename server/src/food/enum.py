from enum import Enum


class CuisineEnum(str, Enum):
    CHINESE = "chinese"
    JAPANESE = "japanese"
    KOREAN = "korean"
    WESTERN = "western"
    THAI = "thai"
    INDIAN = "indian"
    FAST_FOOD = "fast_food"


class MealTypeEnum(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"


class PriceRangeEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ConvenienceEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class FoodStatusEnum(str, Enum):
    WAIT_FOR_PROCESS = "wait_for_process"
    PROCESSING = "processing"
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILED = "failed"
