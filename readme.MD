<div align="center">

```text
 ███╗   ██╗██╗   ██╗██╗  ██╗ █████╗ ██████╗  █████╗
 ████╗  ██║╚██╗ ██╔╝╚██╗██╔╝██╔══██╗██╔══██╗██╔══██╗
 ██╔██╗ ██║ ╚████╔╝  ╚███╔╝ ███████║██████╔╝███████║
 ██║╚██╗██║  ╚██╔╝   ██╔██╗ ██╔══██║██╔══██╗██╔══██║
 ██║ ╚████║   ██║   ██╔╝ ██╗██║  ██║██║  ██║██║  ██║
 ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝
```

### 🔮 Enterprise AI-Powered Mule Account Detection & Compliance Platform

> *"A federated, privacy-preserving graph intelligence framework for dismantling decentralized money-laundering topologies."*

**National Level FinSec Hackathon Submission · Team Nyxara · June 2026**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)

<br/>

[![Dataset](https://img.shields.io/badge/Empirical_Data-9%2C082_Accounts_×_3%2C924_Features-DA70D6?style=flat-square&labelColor=2D1B4E)](#4-dataset-engineering--feature-space-reduction)
[![Architecture](https://img.shields.io/badge/Architecture-Federated_GNN_+_Transformer_+_zkSNARKs-6B21A8?style=flat-square&labelColor=2D1B4E)](#2-algorithmic-contributions--the-6-layer-stack)
[![Performance](https://img.shields.io/badge/Evaluation-0.963_AUC_ROC-2DD4BF?style=flat-square&labelColor=0D3B2F)](#6-experimental-setup--performance-benchmarks)

---

</div>

## 1. Abstract & Executive Summary

The proliferation of decentralized "mule" networks poses an existential threat to the integrity of global digital financial corridors. Conventional Anti-Money Laundering (AML) infrastructures rely heavily on static, rule-based heuristics (e.g., threshold monitoring), rendering them fundamentally inadequate against coordinated smurfing topologies, dormant account takeovers, and remote hijacks (RATs).

**Nyxara** introduces a paradigm-shifting compliance and intelligence platform leveraging high-fidelity Graph Neural Networks (GNNs), continuous behavioral biometrics (BEI), and privacy-preserving federated learning. By mapping the multidimensional topological "shadows" of financial transactions, Nyxara identifies cyclic routing and bipartite laundering graphs with an **AUC-ROC of 0.963**. 

Furthermore, Nyxara ensures strict adherence to India's **PMLA 2002** regulatory frameworks and the **I4C MuleHunter** initiative by cryptographically anchoring all AI-driven compliance decisions into an immutable, zk-SNARK-verifiable Merkle tree ledger, effectively eliminating arbitrary manual censorship.

---

## 2. Algorithmic Contributions: The 6-Layer Stack

Nyxara eschews monolithic classifiers in favor of an ensemble 6-Layer deep intelligence stack. Each layer is engineered to detect orthogonal sub-components of fraudulent topologies.

### Layer 1: Temporal GraphSAGE & GAT Embeddings
Traditional AML ignores temporal graph evolution. We implement a Graph Attention Network (GAT) coupled with GraphSAGE message passing to learn dynamic node embeddings:
$$ h_v^{(l+1)} = \sigma \left( \mathbf{W}^{(l)} \cdot \text{CONCAT}(h_v^{(l)}, \text{AGG}_{u \in \mathcal{N}(v)}(\alpha_{vu} h_u^{(l)})) \right) $$
This layer successfully captures "bursty" behavior typical of smurfing rings awakening from dormancy.

### Layer 2: Graph-Temporal Contrastive Transformer (GTCT)
To combat zero-day (unlabeled) laundering tactics, we utilize a self-supervised contrastive transformer. By enforcing similarity constraints between augmented temporal subgraphs, the encoder learns robust latent representations of fraudulent geometries independent of explicit labels.

### Layer 3: Ridge-Stacked Tabular Ensemble
We extract topological graph metrics (PageRank, Betweenness Centrality) and fuse them with transactional tabular data (velocity, pass-through ratio). A meta-learner via Ridge Regression stacks predictions from Extreme Gradient Boosting (XGBoost), LightGBM, and CatBoost to minimize model-specific inductive bias.

### Layer 4: Variational Autoencoder (VAE) Anomaly Detection
An unsupervised VAE reconstructs transactional feature vectors $\mathbf{x}$. High-risk anomalies are isolated by analyzing the reconstruction log-likelihood:
$$ \mathcal{L}(\theta, \phi; \mathbf{x}) = \mathbb{E}_{q_\phi(\mathbf{z}|\mathbf{x})} [\log p_\theta(\mathbf{x}|\mathbf{z})] - D_{KL}(q_\phi(\mathbf{z}|\mathbf{x}) || p(\mathbf{z})) $$
Data points with reconstruction errors exceeding the 95th percentile are flagged for immediate FIU-IND review.

### Layer 5: Line-Graph (LineMVGNN) Cycle Detection
Money laundering is inherently edge-centric (the transfer of funds). We apply a line-graph transformation $L(G)$, mapping transactional edges to nodes, allowing the GNN to explicitly optimize for deep cycle detection ($A \rightarrow B \rightarrow C \rightarrow A$) spanning across institutional boundaries.

### Layer 6: SHAP & Agentic LLM Narration
Raw probability scores are legally insufficient for compliance. We compute exact Shapley additive explanations (SHAP) to interpret the marginal contribution of every feature. An integrated **Llama 3** agent translates these coefficient vectors into formal FIU-IND Suspicious Transaction Report (STR) narratives.

---

## 3. Kinetic Cyber-Security: Behavioral Entropy Index (BEI)

Sophisticated mule networks increasingly rely on automated scripts or Remote Access Trojans (RATs) to bypass device fingerprinting. Nyxara introduces the **Behavioral Entropy Index (BEI)**, a continuous authentication framework measuring kinetic human-computer interaction.

- **Cursor Curvature & Velocity Variance:** Analyzes the second derivative of mouse trajectories. Robotic scripts yield variance $\sigma^2 \approx 0$ or perfectly linear paths, triggering deterministic block protocols.
- **Keystroke Dynamics (Cv):** Computes the Coefficient of Variation ($C_v = \sigma/\mu$) of flight times between keypress events.
- **TLS Client-Hello Fingerprinting (JA3):** Cross-references SSL handshakes against a database of known headless browser architectures and malware binaries.

---

## 4. Cryptographic Audit Framework & zk-SNARKs

To eliminate insider threat and ensure regulatory transparency, Nyxara anchors its decisions cryptographically.

### Immutable Merkle State Trees
Every AI decision ($\text{Risk} \ge 0.85 \rightarrow \text{BLOCK}$) is hashed via SHA-256 and appended to a continuous Merkle Tree.
$$ H_{\text{root}} = \text{Hash}(H_{\text{left\_child}} || H_{\text{right\_child}}) $$
The 3D **Compliance Center Dashboard** allows auditors to traverse this tree in real-time. Any post-facto database tampering mathematically breaks the parent linkage, instantly turning the UI interface crimson.

### Zero-Knowledge Proofs (Groth16)
Financial institutions must verify compliance without exposing PII (Personally Identifiable Information). Nyxara utilizes zk-SNARKs to generate non-interactive proofs $\pi$:
- **Public Inputs:** Decision (BLOCK/APPROVE), Risk Threshold ($\ge 0.85$).
- **Private Witnesses:** Account ID, Balance, Raw Feature Vectors.
The verifier mathematically proves the AI executed the correct threshold logic without ever exposing the underlying customer data.

---

## 5. Federated Intelligence & Secure Multiparty Computation

Criminal networks exploit the "siloed" nature of competing banks by structuring transfers across multiple institutions. 

Nyxara introduces an interactive **Cross-Bank Federated Graph Simulator**. Utilizing Secure Multiparty Computation (SMPC), participating institutions (e.g., SBI, HDFC, ICICI) collaboratively compute GNN gradient updates across network boundaries. This enables the discovery of inter-bank cyclical laundering loops while strictly maintaining $100\%$ raw data privacy.

---

## 6. Dataset Engineering & Feature Space Reduction

Nyxara was trained and validated on a high-dimensional financial dataset comprising **9,082** distinct accounts and **3,924** raw features.

To mitigate the curse of dimensionality, we executed a rigorous 5-stage reduction pipeline:
1. **Variance Thresholding:** Elimination of quasi-constant vectors.
2. **Sparsity Pruning:** Discarding features with $>70\%$ nullity.
3. **Information Gain:** Selection via Mutual Information criteria.
4. **Collinearity Eradication:** Removal of multicollinear pairs based on a Pearson threshold of $|r| \ge 0.95$.
5. **SHAP Pruning:** A surrogate XGBoost model isolates the final top 50 features ranked by mean absolute SHAP impact.

**Composite Behavioral Vectors Engineered:**
- `Pass-Through Coefficient:` Velocity of inflow-to-outflow bridging.
- `Nocturnal Density Ratio:` Integration of timestamps normalized to 00:00 - 05:00 IST.
- `Financial Impossibility Index:` Ratio of transaction volume to declared occupational income profiles.

---

## 7. Installation & Local Deployment

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Docker & Docker Compose (v2.0+)

### System Orchestration
```bash
# 1. Clone repository & initialize environments
git clone <repo-url> && cd nyxara
cp .env.example .env

# 2. Launch Stateful Dependencies (MongoDB & Redis)
docker-compose up mongo redis -d

# 3. Initialize AI/ML Engines (Terminal 1)
cd ai-engine && pip install -r requirements.txt
python training/run_all.py --dataset ../data/dataset.xlsx
uvicorn main:app --port 8001 --reload

# 4. Initialize Cybersecurity Microservice (Terminal 2)
cd cybersec-engine && pip install -r requirements.txt
uvicorn main:app --port 8002 --reload

# 5. Initialize Blockchain Ledger Microservice (Terminal 3)
cd blockchain-audit && pip install -r requirements.txt
uvicorn main:app --port 8003 --reload

# 6. Boot Gateway Orchestrator (Terminal 4)
cd backend && npm install && npm run dev

# 7. Serve React/Vite Client (Terminal 5)
cd frontend && npm install && npm run dev
```

**Access the Analytics Dashboard:** 
Navigate to [http://localhost:3001](http://localhost:3001) using credentials `admin@nyxara.ai` / `nyxara2026`.

---

<div align="center">

**Engineered with uncompromising precision for the future of Indian Financial Security.**

*June 2026 · Team Nyxara*

</div>