# System Design Tutorial App — Product and Pilot Design

Date: 2026-06-23

## Objective

Build a content-first web application for learning and practicing system design interviews. The application will serve beginners, mid-level interview candidates, and senior engineers by progressively revealing deeper material. It will be implemented with React and deployed on Vercel.

The first release will fully implement one tutorial, **Design a URL Shortener**, and expose the remaining curriculum as clearly labeled upcoming content. The pilot establishes the content model, visual language, reusable tutorial components, and quality bar for the other 24 problems.

## Audience and Learning Model

The app supports three depths within one coherent tutorial:

1. **Fundamentals** explain terminology, constraints, and core building blocks.
2. **Interview-ready** material guides the learner through requirements, estimates, APIs, data, and architecture in the order expected during an interview.
3. **Advanced** sections examine failure modes, distributed-system trade-offs, alternative designs, and evolution at scale.

Each tutorial combines:

- A guided path with a clear recommended reading order.
- Persistent section navigation for reference use.
- Progressive disclosure for advanced details.
- Short knowledge checks that reinforce major decisions without turning the product into a quiz platform.
- Interview prompts and talking points that help users practice communicating the design.

## Curriculum

The curriculum contains these 25 problems:

1. URL Shortener
2. Rate Limiter
3. Pastebin
4. Notification Service
5. Distributed Cache
6. API Gateway
7. Web Crawler
8. Search Autocomplete
9. News Feed
10. Chat System
11. Video Streaming Platform
12. File Storage and Sync
13. Photo Sharing Platform
14. Ride-Hailing Service
15. Food Delivery Platform
16. Ticket Booking System
17. E-commerce Platform
18. Payment System
19. Metrics and Monitoring System
20. Distributed Logging Platform
21. Message Queue
22. Collaborative Document Editor
23. Cloud Drive
24. Maps and Navigation
25. Ad Serving Platform

The problems should eventually be organized by difficulty and dominant concepts rather than presented as an arbitrary list. The pilot may show all 25 in a searchable curriculum page, with URL Shortener marked available and the others marked coming soon.

## Technical Approach

Use a statically generated Next.js application with TypeScript and Tailwind CSS, suitable for deployment on Vercel.

Tutorial content will be authored in MDX. Reusable React components will provide consistent rendering for:

- Requirement and scope tables
- Capacity calculations
- Entity and API definitions
- Decision records
- Trade-off comparisons
- Interview callouts
- Failure scenarios
- Knowledge checks
- Frequently asked questions
- Architecture and sequence diagrams

MDX keeps long-form technical content readable and reviewable while allowing carefully designed interactive components. Content and presentation must remain separated enough that future tutorials can be added without creating bespoke pages.

## Information Architecture

### Home

The home page introduces the learning model, highlights the available tutorial, and presents the broader curriculum. Its primary action starts the URL Shortener tutorial.

### Curriculum

The curriculum page lists all 25 problems with:

- Title and concise description
- Difficulty
- Primary system-design concepts
- Availability state

Filtering may be provided by difficulty or concept if it remains lightweight. Search is useful but not required for the pilot.

### Tutorial

The tutorial layout includes:

- Tutorial title, difficulty, estimated reading time, and concepts
- A persistent desktop table of contents and compact mobile navigation
- Reading progress
- Main article content
- Clear depth labels for Fundamentals, Interview-ready, and Advanced material
- Previous/next section controls

The page must remain useful as a normal reference document even when JavaScript-powered enhancements are unavailable.

## URL Shortener Tutorial Scope

The pilot tutorial will cover the following sections.

### 1. Interview Framing

- A concise problem statement
- Questions the candidate should ask
- Explicit in-scope and out-of-scope decisions
- A suggested interview-time allocation

### 2. Requirements

- Create a short URL for a long URL
- Redirect a short URL
- Optional custom alias
- Optional expiration
- Basic click analytics
- Availability, latency, durability, and consistency goals
- Abuse prevention and security constraints

### 3. Capacity Estimates

Use transparent, editable assumptions to estimate:

- Read/write QPS and peak QPS
- Stored links and metadata
- Storage growth
- Cache working set
- Redirect bandwidth

Calculations must explain why each number influences the architecture. Precision theater should be avoided; estimates are directional tools.

### 4. Entity Model

Define the URL mapping, alias reservation, and click event entities. Show keys, relevant attributes, indexes, retention, and ownership. Distinguish the source-of-truth mapping data from asynchronous analytics data.

### 5. API Design

Specify representative HTTP APIs:

- Create short URL
- Resolve or redirect
- Retrieve link details
- Retrieve aggregate analytics
- Disable or delete a link

For each API, include request/response examples, status codes, idempotency behavior, validation, authentication expectations, and rate-limit implications where relevant.

### 6. Key Generation

Compare:

- Hash-and-truncate
- Database-generated numeric ID encoded in Base62
- Distributed ID generation followed by Base62 encoding
- Random token generation

Explain collision handling, predictability, coordination cost, key-space utilization, and security. Recommend a practical default and show when another strategy becomes preferable.

### 7. High-Level Architecture

Present a precise architecture with:

- DNS and edge/CDN
- Load balancer or API gateway
- Write service
- Redirect service
- Distributed cache
- Durable URL mapping store
- ID generation or token allocation
- Event stream
- Analytics consumers and analytical store
- Abuse detection and observability

The redirect path and creation path must be visually distinct. Components should have explicit responsibilities, and arrows must indicate protocol or data meaning rather than serve as decoration.

### 8. Detailed Flows

Include sequence diagrams for:

- Creating a short URL
- Redirecting on a cache hit
- Redirecting on a cache miss
- Recording click analytics asynchronously
- Handling a disabled or expired link

### 9. Storage and Partitioning

Discuss relational, key-value, and wide-column options. Choose a mapping store based on access patterns, then explain:

- Primary key
- Partition key
- Replication
- Rebalancing
- Hot partitions
- Secondary lookup needs
- Backup and restore

### 10. Caching

Cover cache-aside behavior, TTLs, negative caching, invalidation on disable/delete, hot-key replication, stampede protection, and behavior when the cache is unavailable.

### 11. Consistency and Concurrency

Explain:

- Read-after-write expectations
- Alias uniqueness
- Concurrent custom-alias claims
- Stale cache entries
- Disable/delete propagation
- Analytics consistency

### 12. Scalability and Evolution

Evolve the design through recognizable stages:

1. Single-region modest traffic
2. Partitioned data and distributed cache
3. Multi-region redirect serving
4. Globally distributed low-latency reads

Each stage must state the trigger for added complexity and the new operational costs.

### 13. Resiliency and Failure Modes

Use a failure matrix to cover cache loss, store degradation, regional failure, event-stream lag, analytics failure, ID-generator failure, replication lag, and abusive traffic. For each, identify user impact, detection, mitigation, and recovery.

### 14. Security and Abuse

Cover malicious destinations, phishing and malware scanning, enumeration, unsafe redirects, rate limiting, account quotas, custom-alias squatting, deletion authorization, privacy, and analytics retention.

### 15. Observability

Define meaningful service-level indicators and operational signals, including redirect latency, redirect success rate, cache hit rate, creation error rate, store latency, replication lag, queue lag, abuse blocks, and availability by region.

### 16. Trade-offs and Alternatives

Summarize major decisions in comparison tables and decision callouts. Every recommendation must state what is gained, what is sacrificed, and when to revisit it.

### 17. Interview Summary

Provide a concise end-to-end answer suitable for review before an interview, plus common follow-up questions an interviewer may use to deepen the discussion.

### 18. Knowledge Checks and FAQ

Include short checks after major sections and a final FAQ addressing common misconceptions and interview questions. Answers should explain reasoning rather than merely name a technology.

## Diagram and Image Standards

Architecture diagrams are technical teaching artifacts, not ornamental illustrations.

- Use custom SVG or code-authored vector diagrams for architecture, data flows, sequence diagrams, and scaling evolution.
- Use consistent component shapes, colors, arrow styles, legends, and terminology.
- Label trust boundaries, synchronous versus asynchronous paths, replication, and failure boundaries when relevant.
- Ensure diagrams remain legible on desktop and can be panned, zoomed, or opened at full size on small screens.
- Provide concise alternative text and an adjacent textual explanation.
- Do not use generated imagery for technical diagrams where exact component relationships matter.

Supporting visuals may include restrained conceptual illustrations, small data-flow animations, comparison graphics, and visual mnemonics. They must improve comprehension and should not compete with the technical content.

## Visual Direction

The product should feel like an architect's working notebook refined into a premium learning tool:

- Content-first and calm rather than dashboard-heavy
- Strong typographic hierarchy and comfortable long-form reading
- A restrained neutral palette with one technical accent color and semantic colors for decisions, risks, and advanced material
- Light and dark themes
- Subtle grid, blueprint, or graph-paper cues used sparingly
- Accessible contrast, keyboard navigation, visible focus states, and reduced-motion support

The interface should avoid generic card grids, excessive gradients, decorative glass effects, and animation without instructional value.

## Component Boundaries

The implementation should separate:

- Shell and navigation
- Curriculum metadata
- Tutorial content
- Tutorial layout and section navigation
- Diagram rendering and full-screen viewing
- Structured content components
- Knowledge-check state
- Theme and accessibility preferences

No tutorial-specific business logic should be embedded in the global shell. A new tutorial should mostly consist of an MDX file, metadata, and diagram assets.

## Error Handling

- Invalid tutorial slugs render a useful not-found state.
- Broken or absent optional metadata should fail during build where practical.
- Interactive knowledge checks degrade to readable questions and answers.
- Diagram viewing must not block access to adjacent textual explanations.
- Static generation errors should identify the offending tutorial or component.

## Testing and Verification

The pilot is complete when:

- Type checking, linting, and production build pass.
- Core pages and the URL Shortener tutorial render without runtime errors.
- Internal links and section anchors work.
- The layout is visually checked at representative mobile, tablet, and desktop widths.
- Light and dark themes remain legible.
- Keyboard navigation and focus states are usable.
- Diagrams are readable, technically consistent, and accompanied by textual explanations.
- Knowledge checks work and remain understandable without interaction.
- Content is reviewed for numerical consistency and contradictions between requirements, estimates, APIs, and architecture.

## Out of Scope for the Pilot

- User accounts and cloud-synced progress
- Payments or subscriptions
- Community comments
- Authoring CMS
- Completion of the other 24 tutorials
- Heavy gamification
- Backend services beyond what is needed for a statically generated learning experience

## Acceptance Criteria

The first implementation delivers:

1. A polished, responsive Next.js application deployable to Vercel.
2. Home and curriculum views containing the approved 25-problem syllabus.
3. One complete, technically rigorous URL Shortener tutorial.
4. Precise vector architecture and sequence diagrams.
5. Layered fundamentals, interview-ready, and advanced content.
6. Reusable content components and an MDX-based tutorial model.
7. Short knowledge checks and a substantive FAQ.
8. Clear “Coming soon” entries for future tutorials without implying that their content is available.
