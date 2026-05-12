async function createShipment(order) {
  const token = process.env.DELHIVERY_TOKEN;
  const pickupName = process.env.DELHIVERY_PICKUP_NAME;

  if (!token) throw new Error('DELHIVERY_TOKEN not configured');
  if (!pickupName) throw new Error('DELHIVERY_PICKUP_NAME not configured');

  const isCod = order.payment_method === 'COD';
  const totalRupees = String(order.total_paise / 100);
  const address = [order.address.line1, order.address.line2].filter(Boolean).join(', ');

  const data = {
    shipments: [{
      name: order.customer_name,
      add: address,
      pin: order.address.pin_code,
      city: order.address.city,
      state: order.address.state,
      country: 'India',
      phone: order.customer_phone,
      order: order.id,
      payment: isCod ? 'COD' : 'Prepaid',
      products_desc: 'Saree',
      cod_amount: isCod ? totalRupees : '0',
      order_date: order.created_at_utc,
      total_amount: totalRupees,
      seller_add: "Zohra's House, Hyderabad",
      seller_name: 'Poshakh',
      seller_inv: order.id,
      quantity: '1',
      waybill: '',
      shipment_width: '30',
      shipment_height: '5',
      weight: '0.5',
      seller_gst_tin: '',
      shipping_mode: 'Surface',
      address_type: 'home',
    }],
    pickup_location: { name: pickupName },
  };

  const body = 'format=json&data=' + encodeURIComponent(JSON.stringify(data));
  console.error('Delhivery request payload:', JSON.stringify(data));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('https://track.delhivery.com/api/cmu/create.json', {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: controller.signal,
    });

    const rawText = await res.text();
    console.error('Delhivery raw response:', res.status, rawText);

    let json;
    try { json = JSON.parse(rawText); } catch { throw new Error(`Delhivery non-JSON response (${res.status}): ${rawText.slice(0, 200)}`); }

    if (!res.ok) throw new Error(`Delhivery error (${res.status}): ${json.error || json.message || rawText.slice(0, 200)}`);

    const pkg = json.packages && json.packages[0];

    if (!pkg || pkg.status !== 'Success' || !pkg.waybill) {
      throw new Error(pkg ? (pkg.remarks || JSON.stringify(pkg)) : `Delhivery no package in response: ${rawText.slice(0, 300)}`);
    }

    return {
      awb: pkg.waybill,
      label_url: `https://track.delhivery.com/api/p/packing_slip?wbns=${pkg.waybill}&token=${token}`,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Delhivery request timed out after 5s');
    } else {
      console.error('Delhivery shipment creation failed:', err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { createShipment };
