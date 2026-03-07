import pytest
import os

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="session")
def setup_test_env():
    # Set mock variables for tests
    os.environ["ANTHROPIC_API_KEY"] = "sk-ant-test-mock-key"
    os.environ["REDIS_URL"] = "redis://localhost:6379/1"
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://cvanalyzer:devpassword@localhost/cvanalyzer_test"
    yield
    # Cleanup logic
