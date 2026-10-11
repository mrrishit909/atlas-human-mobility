import json

import pytest

from pipelines.common import LEDGER, PUBLIC


def load(name):
    return json.loads((PUBLIC / name).read_text())


@pytest.fixture(scope="session")
def art():
    cache = {}
    def get(name):
        if name not in cache:
            cache[name] = load(name)
        return cache[name]
    return get


@pytest.fixture(scope="session")
def ledger():
    return json.loads(LEDGER.read_text())
