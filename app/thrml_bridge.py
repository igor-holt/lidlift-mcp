from __future__ import annotations

from typing import Any


def _thrml_available() -> bool:
    try:
        import thrml  # noqa: F401
        return True
    except Exception:
        return False


def run_ising_demo() -> dict[str, Any]:
    if not _thrml_available():
        return {
            "available": False,
            "message": "THRML not installed. Run `pip install thrml` to enable sampling demos.",
        }

    import jax
    import jax.numpy as jnp
    from thrml import Block, SamplingSchedule, SpinNode, sample_states
    from thrml.models import IsingEBM, IsingSamplingProgram, hinton_init

    nodes = [SpinNode() for _ in range(5)]
    edges = [(nodes[i], nodes[i + 1]) for i in range(4)]
    biases = jnp.zeros((5,))
    weights = jnp.ones((4,)) * 0.5
    beta = jnp.array(1.0)
    model = IsingEBM(nodes, edges, biases, weights, beta)

    free_blocks = [Block(nodes[::2]), Block(nodes[1::2])]
    program = IsingSamplingProgram(model, free_blocks, clamped_blocks=[])

    key = jax.random.key(0)
    k_init, k_samp = jax.random.split(key, 2)
    init_state = hinton_init(k_init, model, free_blocks, ())
    schedule = SamplingSchedule(n_warmup=50, n_samples=200, steps_per_sample=2)

    samples = sample_states(k_samp, program, schedule, init_state, [], [Block(nodes)])
    sample_array = samples[0]

    return {
        "available": True,
        "mean": float(jnp.mean(sample_array)),
        "std": float(jnp.std(sample_array)),
        "shape": list(sample_array.shape),
    }
