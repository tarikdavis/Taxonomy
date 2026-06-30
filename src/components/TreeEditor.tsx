import { useCallback, useMemo } from 'react';
import type { NodeRendererProps, TreeApi } from 'react-arborist';
import { SimpleTree, Tree } from 'react-arborist';
import type { ArboristNodeData } from '../lib/taxonomy';
import styles from './TreeEditor.module.css';

interface TreeEditorProps {
  data: ArboristNodeData[];
  selectedId: string | null;
  searchTerm: string;
  onSelect: (id: string | null) => void;
  onChange: (data: ArboristNodeData[]) => void;
  treeRef: React.RefObject<TreeApi<ArboristNodeData> | null>;
}

function cloneData(data: ArboristNodeData[]): ArboristNodeData[] {
  return JSON.parse(JSON.stringify(data)) as ArboristNodeData[];
}

function NodeRow({
  node,
  style,
  dragHandle,
}: NodeRendererProps<ArboristNodeData>) {
  const statusClass = node.data.status === 'tbc' ? styles.tbc : '';

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`${styles.nodeRow} ${node.isSelected ? styles.selected : ''} ${statusClass}`}
      onClick={() => node.select()}
    >
      <span
        className={styles.chevron}
        onClick={(event) => {
          event.stopPropagation();
          node.toggle();
        }}
      >
        {node.isInternal ? (node.isOpen ? '▾' : '▸') : '•'}
      </span>
      <span className={styles.nodeLabel}>{node.data.label}</span>
      {node.data.tags.length > 0 && (
        <span className={styles.tagPreview}>
          {node.data.tags.slice(0, 3).map((tag) => `#${tag}`).join(' ')}
        </span>
      )}
    </div>
  );
}

export function TreeEditor({
  data,
  selectedId,
  searchTerm,
  onSelect,
  onChange,
  treeRef,
}: TreeEditorProps) {
  const syncTree = useCallback(
    (tree: SimpleTree<ArboristNodeData>) => {
      onChange(tree.data as ArboristNodeData[]);
    },
    [onChange],
  );

  const handlers = useMemo(() => {
    const makeTree = () => new SimpleTree<ArboristNodeData>(cloneData(data));

    return {
      onMove: (args: {
        dragIds: string[];
        parentId: string | null;
        index: number;
      }) => {
        const tree = makeTree();
        for (const id of args.dragIds) {
          tree.move({ id, parentId: args.parentId, index: args.index });
        }
        syncTree(tree);
      },
      onRename: ({ id, name }: { id: string; name: string }) => {
        const tree = makeTree();
        tree.update({
          id,
          changes: {
            label: name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
          },
        });
        syncTree(tree);
      },
      onCreate: ({
        parentId,
        index,
        type,
      }: {
        parentId: string | null;
        index: number;
        type: 'internal' | 'leaf';
      }) => {
        const newNode: ArboristNodeData & { children?: ArboristNodeData[] } = {
          id: crypto.randomUUID(),
          label: type === 'internal' ? 'New group' : 'New tag',
          slug: `new-tag-${Date.now()}`,
          tags: [],
          metadata: {},
        };
        if (type === 'internal') {
          newNode.children = [];
        }
        const tree = makeTree();
        tree.create({ parentId, index, data: newNode });
        syncTree(tree);
        return newNode;
      },
      onDelete: ({ ids }: { ids: string[] }) => {
        const tree = makeTree();
        ids
          .filter((id) => id !== 'root')
          .forEach((id) => tree.drop({ id }));
        syncTree(tree);
      },
    };
  }, [data, syncTree]);

  const searchMatch = useMemo(() => {
    if (!searchTerm.trim()) return undefined;
    return (node: { data: ArboristNodeData }, term: string) => {
      const query = term.toLowerCase();
      return (
        node.data.label.toLowerCase().includes(query) ||
        node.data.slug.toLowerCase().includes(query) ||
        node.data.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    };
  }, [searchTerm]);

  return (
    <div className={styles.treeWrap}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolbarButton}
          onClick={() =>
            void treeRef.current?.create({
              type: 'leaf',
              parentId: selectedId ?? 'root',
              index: null,
            })
          }
        >
          Add child
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          onClick={() => {
            if (!selectedId || selectedId === 'root') return;
            if (window.confirm('Delete this node and its children?')) {
              void treeRef.current?.delete(selectedId);
            }
          }}
        >
          Delete selected
        </button>
      </div>
      <Tree
        ref={treeRef}
        data={data}
        width="100%"
        height={520}
        indent={20}
        rowHeight={34}
        openByDefault
        searchTerm={searchTerm}
        searchMatch={searchMatch}
        selection={selectedId ?? undefined}
        onSelect={(nodes) => onSelect(nodes[0]?.id ?? null)}
        onMove={handlers.onMove}
        onRename={handlers.onRename}
        onCreate={handlers.onCreate}
        onDelete={handlers.onDelete}
      >
        {NodeRow}
      </Tree>
    </div>
  );
}
