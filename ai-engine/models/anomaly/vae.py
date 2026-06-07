"""
models/anomaly/vae.py
Variational AutoEncoder — zero-day mule detection.
Trained ONLY on legitimate accounts. Mule accounts have high reconstruction error.
"""
import json
import logging
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset

logger = logging.getLogger("nyxara.vae")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


class VAE(nn.Module):
    """
    Simple MLP-based VAE. No convolutions needed — tabular data.
    Encoder → μ, σ → reparameterize → z → Decoder → reconstruction
    """

    def __init__(self, input_dim: int, hidden_dim: int = 128, latent_dim: int = 32):
        super().__init__()
        self.latent_dim = latent_dim

        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
        )
        self.mu_layer = nn.Linear(hidden_dim // 2, latent_dim)
        self.logvar_layer = nn.Linear(hidden_dim // 2, latent_dim)

        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, input_dim),
        )

    def encode(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        h = self.encoder(x)
        return self.mu_layer(h), self.logvar_layer(h)

    def reparameterize(self, mu: torch.Tensor, logvar: torch.Tensor) -> torch.Tensor:
        if self.training:
            std = torch.exp(0.5 * logvar)
            eps = torch.randn_like(std)
            return mu + eps * std
        return mu  # Deterministic at inference

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        return self.decoder(z)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        x_hat = self.decode(z)
        return x_hat, mu, logvar

    def reconstruction_error(self, x: torch.Tensor) -> torch.Tensor:
        """MSE reconstruction error per sample (anomaly score)."""
        with torch.no_grad():
            x_hat, _, _ = self.forward(x)
            return F.mse_loss(x_hat, x, reduction="none").mean(dim=1)


def vae_loss(x: torch.Tensor, x_hat: torch.Tensor, mu: torch.Tensor, logvar: torch.Tensor) -> torch.Tensor:
    """ELBO loss: reconstruction + KL divergence."""
    recon = F.mse_loss(x_hat, x, reduction="sum")
    kl = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
    return recon + 0.001 * kl  # β = 0.001 to balance terms


def train_vae(
    X_legit: np.ndarray,
    epochs: int = 100,
    batch_size: int = 256,
    lr: float = 1e-3,
    percentile: float = 95.0,
) -> VAE:
    """
    Train VAE on legitimate account features only.
    Computes 95th percentile threshold for anomaly detection.
    """
    input_dim = X_legit.shape[1]
    model = VAE(input_dim=input_dim, hidden_dim=128, latent_dim=32)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    X_tensor = torch.FloatTensor(X_legit)
    dataset = TensorDataset(X_tensor)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    logger.info(f"Training VAE on {len(X_legit)} legitimate accounts | {epochs} epochs")

    model.train()
    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for (batch,) in loader:
            optimizer.zero_grad()
            x_hat, mu, logvar = model(batch)
            loss = vae_loss(batch, x_hat, mu, logvar)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if epoch % 20 == 0:
            logger.info(f"VAE Epoch {epoch}/{epochs} | Loss: {total_loss / len(loader):.4f}")

    # Compute anomaly threshold on training data
    model.eval()
    recon_errors = model.reconstruction_error(X_tensor).numpy()
    threshold = float(np.percentile(recon_errors, percentile))
    logger.info(f"VAE threshold (P{percentile:.0f}): {threshold:.6f}")

    # Save
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), ARTIFACTS_DIR / "vae_model.pth")
    with open(ARTIFACTS_DIR / "vae_threshold.json", "w") as f:
        json.dump({"threshold": threshold, "percentile": percentile, "input_dim": input_dim}, f)

    return model


def load_vae() -> tuple[VAE, float]:
    """Load VAE model and threshold."""
    with open(ARTIFACTS_DIR / "vae_threshold.json") as f:
        meta = json.load(f)
    model = VAE(input_dim=meta["input_dim"])
    model.load_state_dict(torch.load(ARTIFACTS_DIR / "vae_model.pth", map_location="cpu"))
    model.eval()
    return model, float(meta["threshold"])


def get_vae_anomaly_score(model: VAE, threshold: float, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Returns (normalized_anomaly_score [0,1], is_anomaly [bool]).
    Score = reconstruction_error / threshold, clipped to [0, 3].
    """
    X_tensor = torch.FloatTensor(X)
    errors = model.reconstruction_error(X_tensor).numpy()
    scores = np.clip(errors / threshold, 0, 3) / 3.0  # Normalize to [0,1]
    is_anomaly = errors > threshold
    return scores, is_anomaly