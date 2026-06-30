import type { TaxonomyNode } from '../lib/taxonomy';
import styles from './NodeDetailPanel.module.css';

interface NodeDetailPanelProps {
  node: TaxonomyNode | null;
  onUpdate: (id: string, changes: Partial<TaxonomyNode>) => void;
}

export function NodeDetailPanel({ node, onUpdate }: NodeDetailPanelProps) {
  if (!node || node.id === 'root') {
    return (
      <aside className={styles.panel}>
        <h2>Node details</h2>
        <p className={styles.empty}>Select a node in the tree to edit its tags and metadata.</p>
      </aside>
    );
  }

  const metadataEntries = Object.entries(node.metadata);

  return (
    <aside className={styles.panel}>
      <h2>Node details</h2>

      <label className={styles.field}>
        <span>Label</span>
        <input
          value={node.label}
          onChange={(event) => onUpdate(node.id, { label: event.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span>Slug</span>
        <input
          value={node.slug}
          onChange={(event) => onUpdate(node.id, { slug: event.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span>Tags (comma-separated)</span>
        <textarea
          rows={4}
          value={node.tags.join(', ')}
          onChange={(event) =>
            onUpdate(node.id, {
              tags: event.target.value
                .split(',')
                .map((tag) => tag.trim().replace(/^#/, ''))
                .filter(Boolean),
            })
          }
        />
      </label>

      <label className={styles.field}>
        <span>Status</span>
        <select
          value={node.status ?? ''}
          onChange={(event) =>
            onUpdate(node.id, {
              status: event.target.value === 'tbc' ? 'tbc' : undefined,
            })
          }
        >
          <option value="">Active</option>
          <option value="tbc">To be classified</option>
        </select>
      </label>

      <div className={styles.metadataSection}>
        <div className={styles.metadataHeader}>
          <h3>Metadata</h3>
        </div>
        {metadataEntries.length === 0 ? (
          <p className={styles.empty}>No metadata yet.</p>
        ) : (
          <ul className={styles.metadataList}>
            {metadataEntries.map(([key, value]) => (
              <li key={key}>
                <strong>{key}</strong>: {value}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            const key = window.prompt('Metadata key');
            if (!key) return;
            const value = window.prompt('Metadata value') ?? '';
            onUpdate(node.id, {
              metadata: { ...node.metadata, [key]: value },
            });
          }}
        >
          Add metadata
        </button>
      </div>
    </aside>
  );
}
