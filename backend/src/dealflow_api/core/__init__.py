"""Motor — lógica pura, migrada de ../../../src/dealflow/.

A migração será incremental. Hoje os agentes (matcher/estimator/archetypist)
são placeholders. Quando migrarmos, este pacote receberá:

    core/domain.py      <- src/dealflow/domain.py
    core/multipliers.py <- src/dealflow/multipliers.py
    core/estimator.py   <- src/dealflow/estimator.py
    core/pipeline.py    <- src/dealflow/pipeline.py
"""
