# audit-pipeline

## HLD
![audit-pipeline-hld](audit-pipeline-hld.png)

The system simply has: 
- an API that saves audit evidence and auditor edits immediately
- background workers that enrich relevant records with risk insights
- a queue that lets enrichment scale independently