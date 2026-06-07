"""
models/gnn/model.py
NyxaraGNN: GraphSAGE → GAT → GraphSAGE + skip connections.
Designed for CPU training on ~9K nodes. ~20-30 min on laptop.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv, GATConv, BatchNorm


class NyxaraGNN(nn.Module):
    """
    3-layer GNN:
      Layer 1: SAGEConv (neighborhood aggregation)
      Layer 2: GATConv (attention — learns which neighbors matter)
      Layer 3: SAGEConv + skip connection from input
    Output: 2-class fraud probability
    """

    def __init__(
        self,
        in_channels: int,
        hidden_channels: int = 128,
        out_channels: int = 2,
        dropout: float = 0.3,
        gat_heads: int = 4,
    ):
        super().__init__()
        self.dropout = dropout

        # Layer 1: SAGE
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.bn1 = BatchNorm(hidden_channels)

        # Layer 2: GAT (multi-head attention)
        self.conv2 = GATConv(hidden_channels, hidden_channels // gat_heads, heads=gat_heads, dropout=dropout)
        self.bn2 = BatchNorm(hidden_channels)

        # Layer 3: SAGE + skip connection
        self.conv3 = SAGEConv(hidden_channels, hidden_channels)
        self.bn3 = BatchNorm(hidden_channels)

        # Skip connection projection (input → hidden)
        self.skip_proj = nn.Linear(in_channels, hidden_channels)

        # Classifier head
        self.classifier = nn.Sequential(
            nn.Linear(hidden_channels, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, out_channels),
        )

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        # Skip connection from input
        skip = F.relu(self.skip_proj(x))

        # Layer 1
        h = self.conv1(x, edge_index)
        h = self.bn1(h)
        h = F.relu(h)
        h = F.dropout(h, p=self.dropout, training=self.training)

        # Layer 2
        h = self.conv2(h, edge_index)
        h = self.bn2(h)
        h = F.relu(h)
        h = F.dropout(h, p=self.dropout, training=self.training)

        # Layer 3 + skip
        h = self.conv3(h, edge_index)
        h = self.bn3(h)
        h = F.relu(h + skip)  # Residual connection

        # Classify
        return self.classifier(h)

    def get_embeddings(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """Return node embeddings (before classifier) — useful for visualization."""
        with torch.no_grad():
            skip = F.relu(self.skip_proj(x))
            h = F.relu(self.bn1(self.conv1(x, edge_index)))
            h = F.relu(self.bn2(self.conv2(h, edge_index)))
            h = F.relu(self.bn3(self.conv3(h, edge_index)) + skip)
        return h