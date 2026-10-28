from datetime import date
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Filters(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start_date: date | None = None
    end_date: date | None = None  # exclusive
    states: list[str] = Field(default_factory=list, max_length=27)
    seller_ids: list[str] = Field(default_factory=list, max_length=100)
    categories: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def dates(self):
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValueError("start_date must precede exclusive end_date")
        return self


class MetricQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    metric_id: str = Field(max_length=150)
    filters: Filters = Field(default_factory=Filters)


class DashboardContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    filters: Filters = Field(default_factory=Filters)
    widget_id: str | None = None
    metric_id: str | None = None
    displayed_value: Any = None
    data_version: str | None = None
    metrics_version: str | None = None


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str | None = Field(default=None, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    message: str = Field(min_length=1, max_length=20000)
    dashboard_context: DashboardContext | None = None


class ChartSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["line", "bar"]
    title: str
    table_id: str
    x: str
    y: list[str] = Field(min_length=1)


class AgentAnswer(BaseModel):
    text: str
    charts: list[ChartSpec] = Field(default_factory=list)
