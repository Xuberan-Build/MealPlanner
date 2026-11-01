// src/features/shoppingList/components/ShoppingListRow.js
//
// One clean shopping list row:
//   [bought checkbox]  Name                              [pantry toggle] [edit]
//                      2 cups + 50 g   (or "need 1 cup (have some)", "to taste")
//                      from: Tacos, Chili                (muted)
//                      product chip / hints               (optional)
//
// variant 'buy'  -> the To buy section (checkbox, pantry toggle, product matching)
// variant 'have' -> the Already have section ("Actually need it" button, "check amount" flag)

import React, { useMemo, useState } from 'react';
import { Pencil, Package } from 'lucide-react';
import PantryToggleButton from '../../pantry/PantryToggleButton';
import ProductMatchModal from './ProductMatchModal';
import { formatPrice } from '../../../utils/productUtils';
import { displayQuantity, sourceTitles } from '../listModel';
import { toStoreQuantity } from '../../../utils/storeUnits';
import styles from './ShoppingListRow.module.css';

const ShoppingListRow = ({
  item,
  variant = 'buy',
  smartMatching = false,
  onToggleBought,
  onPantryChange,
  onEdit,
  onProductSelect,
}) => {
  const [showProductModal, setShowProductModal] = useState(false);
  const checkboxId = `bought-${item.id}`;
  const status = item.effectiveStatus || 'need';
  const quantity = displayQuantity(item);
  // What you actually buy ("2 heads"); partly-covered items keep their "need X" amount.
  const store = status === 'partial' && !item.completed ? null : toStoreQuantity(item);
  const sources = sourceTitles(item);
  const product = item.productMatch && item.productMatch.selectedProduct;
  const isBuy = variant === 'buy';

  // Stable object so the modal does not refetch on every parent render.
  const ingredient = useMemo(
    () => ({ name: item.name, quantity: item.quantity, unit: item.unit, category: item.category }),
    [item.name, item.quantity, item.unit, item.category]
  );

  const rowClass = [
    styles.row,
    item.completed ? styles.bought : '',
    !isBuy ? styles.haveRow : '',
  ].filter(Boolean).join(' ');

  return (
    <li className={rowClass}>
      {isBuy && (
        <div className={styles.checkCell}>
          <input
            id={checkboxId}
            type="checkbox"
            className={styles.checkbox}
            checked={item.completed}
            onChange={() => onToggleBought && onToggleBought(item)}
            aria-label={`${item.completed ? 'Unmark' : 'Mark'} ${item.name} as bought`}
          />
        </div>
      )}

      <div className={styles.body}>
        {isBuy ? (
          <label htmlFor={checkboxId} className={styles.name}>{item.name}</label>
        ) : (
          <span className={styles.name}>{item.name}</span>
        )}

        {quantity && (
          <span className={`${styles.quantity} ${status === 'partial' && !item.completed ? styles.partialQty : ''}`}>
            {store ? store.text : quantity}
            {store && store.detail ? ` (${store.detail})` : ''}
            {!store && item.sizeNote ? ` · ${item.sizeNote}` : ''}
          </span>
        )}

        {store && store.forText && (
          <span className={styles.forText}>{store.forText}</span>
        )}

        {sources.length > 0 && (
          <span className={styles.sources}>from: {sources.join(', ')}</span>
        )}

        {!isBuy && item.pantryMatch && item.pantryMatch.name && (
          <span className={styles.sources}>in pantry: {item.pantryMatch.name}</span>
        )}

        <div className={styles.hints}>
          {item.servingsUnknown && (
            <span className={styles.hint} title="This recipe has no servings set, so the amounts are for one batch">
              recipe servings missing: amount is for one batch
            </span>
          )}
          {item.needsCheck && !item.completed && (
            <span className={`${styles.hint} ${styles.checkHint}`} title="Your pantry amount uses different units, so check you have enough">
              check amount
            </span>
          )}
          {item.notes && <span className={styles.note}>{item.notes}</span>}
        </div>

        {isBuy && smartMatching && !item.completed && (
          product ? (
            <button
              type="button"
              className={styles.productChip}
              onClick={() => setShowProductModal(true)}
              aria-label={`Change product for ${item.name}`}
            >
              {product.imageSmallUrl && (
                <img src={product.imageSmallUrl} alt="" className={styles.productThumb} />
              )}
              <span className={styles.productText}>
                {[product.brand, product.productName].filter(Boolean).join(' · ')}
                {product.price ? ` · ${formatPrice(product.price)}` : ''}
              </span>
            </button>
          ) : null
        )}
      </div>

      <div className={styles.actions}>
        {isBuy ? (
          <>
            {!item.completed && (
              <PantryToggleButton item={item} pantryStatus={status} onChange={onPantryChange} compact />
            )}
            {smartMatching && !item.completed && !product && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setShowProductModal(true)}
                aria-label={`Find a product for ${item.name}`}
                title="Find a specific product"
              >
                <Package size={16} />
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className={styles.needButton}
            onClick={() => onPantryChange && onPantryChange('need', item)}
            aria-label={`Actually need ${item.name}: move it to the list`}
          >
            Actually need it
          </button>
        )}
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onEdit && onEdit(item)}
          aria-label={`Edit ${item.name}`}
          title="Edit"
        >
          <Pencil size={16} />
        </button>
      </div>

      {showProductModal && (
        <ProductMatchModal
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          ingredient={ingredient}
          currentProduct={product || null}
          onProductSelect={(p) => onProductSelect && onProductSelect(item.id, p)}
        />
      )}
    </li>
  );
};

export default ShoppingListRow;
