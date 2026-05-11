"""Entry point manual. Use os notebooks ou tests para validar o protótipo.

    uv run python main.py    → smoke do import path
    uv run pytest            → testa fórmula + chave de match
"""

from dealflow import __version__


def main() -> None:
    print(f"DealFlow BR v{__version__} — protótipo MVP (RJ/SP)")
    print("Veja docs/architecture.md e README.md para próximos passos.")


if __name__ == "__main__":
    main()
