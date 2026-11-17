export default function List() {
  return (
    <main className="inner">
      <section>
        <h1>List</h1>
        <div className="inventory">
          <section className="inventory-section">
            <p className="eyebrow">01 / pantry</p>
            <h2>Coffee beans we have</h2>
            <ul>
              <li><strong>Colombia La Pradera</strong><span>washed · honey · red apple</span></li>
              <li><strong>Ethiopia Konga</strong><span>natural · jasmine · blueberry</span></li>
              <li><strong>Guatemala El Injerto</strong><span>washed · cocoa · citrus</span></li>
            </ul>
          </section>
          <section className="inventory-section">
            <p className="eyebrow">02 / wishlist</p>
            <h2>Coffee beans we want to get</h2>
            <ul>
              <li><strong>Kenya Gachatha</strong><span>blackcurrant · hibiscus · sweet</span></li>
              <li><strong>Rwanda Shyira</strong><span>red fruit · caramel · tea-like</span></li>
              <li><strong>Something decaf</strong><span>surprise us</span></li>
            </ul>
          </section>
          <section className="inventory-section">
            <p className="eyebrow">03 / kit</p>
            <h2>Equipment</h2>
            <ul>
              <li><strong>Hario V60 02</strong><span>ceramic · white</span></li>
              <li><strong>Fellow Stagg EKG</strong><span>gooseneck kettle · 0.9 L</span></li>
              <li><strong>Timemore C2</strong><span>hand grinder</span></li>
              <li><strong>Acaia Pearl</strong><span>brew scale</span></li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
