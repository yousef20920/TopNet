# Natural-Language Cloud Network Topology Copilot

Turn plain-English infrastructure descriptions into validated, deployable cloud network topologies (graph + Terraform).

This repo will host an MVP focused on **AWS only**, with a **cloud-agnostic intermediate graph** that can later be extended to other providers.

---

## Vision

> “Create three private subnets across two AZs, a public load balancer, a web tier behind it, a database subnet, and a traffic generator between regions.”

This project should:

* Parse that description into a **topology graph** (IR).
* Infer **sane defaults** (CIDRs, AZs, ports, redundancy).
* Run **validation checks** (overlapping IPs, SPOFs, unsafe SGs).
* Compile into **Terraform** (JSON or HCL) for AWS.
* Provide a **visual editor** to inspect and tweak the topology.

---

## MVP Scope (v0)

**Constraints for first implementation:**

* **Cloud:** AWS only
* **Direction:** NL → Graph → Terraform (no import yet)
* **Compute/Network resources:**

  * VPC
  * Subnet (public/private)
  * Internet Gateway
  * NAT Gateway (single-AZ for now)
  * Route Tables
  * Security Groups
  * Application Load Balancer
  * EC2 instances (web/app)
  * RDS (single instance, no replicas)
* **UX:**

  * Simple text prompt → “Generate topology”
  * Graph view (nodes + edges, basic layout)
  * “Generate Terraform” → downloadable Terraform files
* **Safety:** Plan-only (no direct `terraform apply`)

---

## Tech Stack (proposed)

* **Backend:**

  * Node.js + TypeScript
  * Framework: Express or Fastify
  * Graph/model logic + Terraform generation
* **Frontend:**

  * React + TypeScript
  * Graph UI: [React Flow](https://reactflow.dev/) (or similar)
* **Infra-as-code Output:**

  * Terraform **JSON** (`*.tf.json`) for simplicity
* **LLM Integration:**

  * Backend endpoint that calls out to an LLM (stubbed locally for now)

> **Copilot hint:** When implementing backend modules, follow the interfaces in the “Core Data Structures” section below as the source of truth.

---

## Core Data Structures (Intermediate Representation)

> These types define the core **graph IR**. Use and refine them in the backend.

```ts
// src/core/types.ts

export type Provider = "aws" | "azure" | "gcp" | "generic";

export type NodeKind =
  | "network"          // VPC / VNet / VPC Network
  | "subnet"
  | "security_group"
  | "load_balancer"
  | "compute_instance"
  | "database"
  | "gateway"          // IGW, NAT
  | "traffic_generator"
  | "route_table";

export type EdgeKind =
  | "attached_to"      // subnet -> vpc
  | "routes_to"        // route_table -> gateway/subnet
  | "allowed_traffic"  // sg -> sg or sg -> subnet
  | "depends_on"
  | "contains";

export interface BaseNode {
  id: string;
  kind: NodeKind;
  name?: string;
  provider?: Provider;
  region?: string;
  az?: string;
  tags?: Record<string, string>;
  // For MVP, keep props generic; later: split into typed per-kind props
  props: Record<string, any>;
}

export interface Edge {
  id: string;
  kind: EdgeKind;
  from: string; // node id
  to: string;   // node id
  props?: Record<string, any>;
}

export interface TopologyGraph {
  id: string;
  name?: string;
  nodes: BaseNode[];
  edges: Edge[];
  metadata?: Record<string, any>;
}
```

---

## High-Level Architecture

### 1. Frontend (React)

* Text area for prompt
* “Generate topology” button
* Graph canvas (React Flow)
* Node inspector sidebar (edit props)
* “Generate Terraform” button

### 2. Backend (Node + TS)

Core modules:

* `nlp/`: NL → high-level spec
* `builder/`: spec → `TopologyGraph`
* `validation/`: passes over `TopologyGraph`
* `terraform/`: `TopologyGraph` → Terraform JSON
* `api/`: HTTP endpoints for frontend

---

## API Sketch

> Implement these endpoints first; expand later as needed.

```txt
POST /api/topologies/generate
  body: { prompt: string }
  returns: { topology: TopologyGraph, validation: ValidationResult[] }

POST /api/topologies/validate
  body: { topology: TopologyGraph }
  returns: { validation: ValidationResult[] }

POST /api/topologies/terraform
  body: { topology: TopologyGraph }
  returns: { files: TerraformFile[] } // base64 or inline text

type Severity = "info" | "warning" | "error";

interface ValidationResult {
  id: string;
  severity: Severity;
  message: string;
  nodeIds?: string[];
}
```

```ts
// src/core/terraform/types.ts

export interface TerraformFile {
  filename: string;
  content: string; // full file contents
}
```

---

## NL → Graph Pipeline (MVP)

For v0, keep it simple:

1. **NL → TopologySpec** (LLM-aided, but easy to stub for tests):

   ```ts
   // src/core/spec.ts
   export interface ComponentSpec {
     role: "web_tier" | "db_tier" | "traffic_gen" | "networking" | "other";
     quantity?: number;
     description: string;
     constraints?: Record<string, any>;
   }

   export interface TopologySpec {
     provider: "aws";
     region: string;
     components: ComponentSpec[];
   }
   ```

2. **TopologySpec → TopologyGraph** (pure code, deterministic):

   * Create VPC
   * Allocate subnets
   * Assign AZs
   * Create SGs, ALB, EC2, RDS
   * Wire edges (`attached_to`, `allowed_traffic`, `routes_to`)

3. **Default inference** (in builder):

   * VPC CIDR: `10.0.0.0/16`
   * Subnets: `10.0.X.0/24` (no overlap)
   * 2 AZs chosen deterministically (e.g. `a`, `b`)
   * Ports:

     * web: `80/443`
     * db: `5432` or `3306` (configurable)
   * Public subnet: route to IGW
   * Private subnet: route via NAT (if outbound needed)

> **Copilot hint:** Implement `buildTopologyGraphFromSpec(spec: TopologySpec): TopologyGraph` in `src/core/builder.ts` and keep it side-effect-free.

---

## Validation Passes (MVP)

Create modular validators that accept a `TopologyGraph` and return `ValidationResult[]`.

Initial validators:

1. **CIDR Overlap Validator**

   * Detect overlapping subnet CIDR blocks within same VPC.

2. **Orphaned Node Validator**

   * Subnets not attached to a network
   * Instances without subnets

3. **Reachability Validator**

   * Check DB nodes are only reachable from web SGs (not from `0.0.0.0/0`).

4. **SPOF / HA Validator**

   * If user mentions HA / “across AZs” but resources only in one AZ, warn.

File layout (suggested):

```txt
src/
  core/
    types.ts
    spec.ts
    builder.ts
    validation/
      index.ts
      cidrOverlap.ts
      orphanedNodes.ts
      reachability.ts
      ha.ts
  terraform/
    aws/
      vpc.ts
      subnet.ts
      securityGroup.ts
      alb.ts
      ec2.ts
      rds.ts
    renderer.ts
  api/
    topologies.ts
  frontend/  // or separate package
```

---

## Terraform Generation (AWS, MVP)

* Use **Terraform JSON** output (`main.tf.json`).
* Map graph node kinds → AWS resources:

  * `network` → `aws_vpc`
  * `subnet` → `aws_subnet`
  * `gateway` (IGW/NAT) → `aws_internet_gateway`, `aws_nat_gateway`
  * `route_table` → `aws_route_table`, `aws_route_table_association`
  * `security_group` → `aws_security_group`
  * `load_balancer` → `aws_lb`, `aws_lb_target_group`, `aws_lb_listener`
  * `compute_instance` → `aws_instance`
  * `database` → `aws_db_instance`

Skeleton:

```ts
// src/terraform/aws/generateAwsTerraform.ts
import { TopologyGraph } from "../../core/types";
import { TerraformFile } from "../types";

export function generateAwsTerraform(graph: TopologyGraph): TerraformFile[] {
  // 1. Collect resources from graph
  // 2. Build Terraform JSON structure
  // 3. Return as [{ filename: "main.tf.json", content }]
  return [];
}
```

---

## Frontend Sketch

Features for MVP:

* Text area for natural language prompt
* Button: “Generate Topology”

  * Calls `/api/topologies/generate`
* React Flow graph:

  * Node types: VPC, subnet, SG, EC2, RDS, ALB, gateway
  * Simple auto-layout by level:

    * VPC at top
    * Subnets in middle
    * Instances/DB/ALB inside subnets
* Side panel:

  * Show selected node properties (name, CIDR, AZ, ports)
  * Allow editing, then send updated `TopologyGraph` back to backend if needed
* Button: “Generate Terraform”

  * Calls `/api/topologies/terraform`
  * Shows `main.tf.json` in a code block + download option

---

## Roadmap

### Phase 1 – Skeleton & Types

* [x] Initialize Node + TS backend project
* [x] Add core types (`TopologyGraph`, nodes, edges)
* [x] Implement dummy endpoint `/api/topologies/generate` that returns a hardcoded graph
* [x] Implement basic React app with React Flow to display the graph

### Phase 2 – Spec → Graph

* [x] Define `TopologySpec` and `ComponentSpec`
* [x] Implement `buildTopologyGraphFromSpec`
* [x] Replace hardcoded graph with spec-based builder
* [x] Add stubs for NL → `TopologySpec` (mocked function + TODO for actual LLM call)

### Phase 3 – Validation

* [x] Implement CIDR overlap validator
* [x] Implement orphaned node validator
* [x] Implement basic reachability checks (web → db only)
* [x] Implement HA/SPOF validator
* [x] Wire validation results into `/api/topologies/generate`
* [x] Show validation results in frontend

### Phase 4 – Terraform Output (AWS)

* [x] Implement mappings from graph node kinds → Terraform JSON
* [x] Generate `main.tf.json` from a `TopologyGraph`
* [x] Add `/api/topologies/terraform` endpoint
* [x] Frontend: code viewer + download button

### Phase 5 – Polish & UX

* [x] Better auto-layout for graph
* [x] Node icons / colors by kind
* [x] Editable properties in UI
* [x] Simple versioning: save/load topologies

---

## Copilot Usage Notes

* Use this file as a **context anchor** for Copilot:

  * It should infer types and architecture from the “Core Data Structures”, “API Sketch”, and “Roadmap”.
* When creating new files:

  * Start with small, well-typed functions (e.g., `buildVpcNode`, `allocateSubnets`), and let Copilot fill repetitive mappings.
* When adding validation or Terraform mappings:

  * Write one or two clear examples manually, then ask Copilot (via comments) to extend the pattern.