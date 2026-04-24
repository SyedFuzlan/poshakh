import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
  updateStoresStep,
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => ({
      selector: { id: data.input.store_id },
      update: {
        supported_currencies: data.input.supported_currencies.map((c) => ({
          currency_code: c.currency_code,
          is_default: c.is_default ?? false,
        })),
      },
    }));
    const stores = updateStoresStep(normalizedInput);
    return new WorkflowResponse(stores);
  }
);

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [{ name: "Default Sales Channel" }],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        { currency_code: "inr", is_default: true },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_sales_channel_id: defaultSalesChannel[0].id },
    },
  });

  logger.info("Seeding India region...");
  let region = null;
  const existingRegions = await query.graph({
    entity: "region",
    fields: ["id", "name"],
    filters: { name: "India" },
  });
  
  if (existingRegions.data && existingRegions.data.length > 0) {
    region = existingRegions.data[0];
    logger.info("India region already exists, skipping creation.");
  } else {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "India",
            currency_code: "inr",
            countries: ["in"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    region = regionResult[0];
    logger.info("Finished seeding region.");
  }

  logger.info("Seeding tax regions...");
  const existingTaxRegions = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
    filters: { country_code: "in" },
  });
  
  if (!existingTaxRegions.data || existingTaxRegions.data.length === 0) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "in", provider_id: "tp_system" }],
    });
    logger.info("Finished seeding tax regions.");
  } else {
    logger.info("Tax region for India already exists, skipping creation.");
  }

  logger.info("Seeding stock location...");
  let stockLocation = null;
  const existingStockLocations = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: "Hyderabad Warehouse" },
  });

  if (existingStockLocations.data && existingStockLocations.data.length > 0) {
    stockLocation = existingStockLocations.data[0];
    logger.info("Hyderabad Warehouse stock location already exists, skipping creation.");
  } else {
    const { result: stockLocationResult } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Hyderabad Warehouse",
            address: {
              city: "Hyderabad",
              country_code: "IN",
              address_1: "Hyderabad, Telangana",
            },
          },
        ],
      },
    });
    stockLocation = stockLocationResult[0];
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: stockLocation.id },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({ type: "default" });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    });
    shippingProfile = shippingProfileResult[0];
  }

  let fulfillmentSet = null;
  const existingFulfillmentSets = await fulfillmentModuleService.listFulfillmentSets({
    name: "India Delivery",
  });

  if (existingFulfillmentSets.length > 0) {
    fulfillmentSet = existingFulfillmentSets[0];
    logger.info("India Delivery fulfillment set already exists, skipping creation.");
    // Fetch with service zones if needed
    const fullFulfillmentSet = await fulfillmentModuleService.retrieveFulfillmentSet(fulfillmentSet.id, {
      relations: ["service_zones"],
    });
    fulfillmentSet = fullFulfillmentSet;
  } else {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "India Delivery",
      type: "shipping",
      service_zones: [
        {
          name: "India",
          geo_zones: [{ country_code: "in", type: "country" }],
        },
      ],
    });
  }

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: { label: "Standard", description: "Delivered in 5–7 days.", code: "standard" },
        prices: [
          { currency_code: "inr", amount: 9900 },
          { currency_code: "inr", region_id: region.id, amount: 9900 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Express Delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: { label: "Express", description: "Delivered in 2–3 days.", code: "express" },
        prices: [
          { currency_code: "inr", amount: 19900 },
          { currency_code: "inr", region_id: region.id, amount: 19900 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [defaultSalesChannel[0].id] },
  });

  logger.info("Seeding publishable API key...");
  let publishableApiKey: ApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: { type: "publishable" },
  });
  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const { result: [publishableApiKeyResult] } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: "Poshakh Webshop", type: "publishable", created_by: "" }],
      },
    });
    publishableApiKey = publishableApiKeyResult as ApiKey;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: publishableApiKey.id, add: [defaultSalesChannel[0].id] },
  });
  logger.info(`Publishable API key: ${publishableApiKey.token ?? publishableApiKey.id}`);

  logger.info("Seeding product categories...");
  
  // Check for existing categories
  const existingCategories = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
    filters: { name: ["Sarees", "Salwar Kameez", "Lehengas", "Gowns"] },
  });

  let categoryResult = existingCategories.data || [];

  // Create only missing categories
  const categoryNames = ["Sarees", "Salwar Kameez", "Lehengas", "Gowns"];
  const missingCategories = categoryNames.filter(
    (name) => !categoryResult.find((c) => c.name === name)
  );

  if (missingCategories.length > 0) {
    const { result: newCategories } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingCategories.map((name) => ({
          name,
          is_active: true,
        })),
      },
    });
    categoryResult = [...categoryResult, ...newCategories];
  }

  const sareesId = categoryResult.find((c) => c.name === "Sarees")!.id;
  const salwarId = categoryResult.find((c) => c.name === "Salwar Kameez")!.id;
  const lehengaId = categoryResult.find((c) => c.name === "Lehengas")!.id;
  const gownsId = categoryResult.find((c) => c.name === "Gowns")!.id;

  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

  function makeVariants(skuPrefix: string, prices: { currency_code: string; amount: number }[]) {
    return sizes.map((size) => ({
      title: size,
      sku: `${skuPrefix}-${size}`,
      options: { Size: size },
      prices,
    }));
  }

  logger.info("Seeding products...");
  await createProductsWorkflow(container).run({
    input: {
      products: [
        // ── SAREES ──
        {
          title: "Maroon Banarasi Silk Saree",
          category_ids: [sareesId],
          description: "Handwoven Banarasi silk saree in rich maroon with gold zari border. Perfect for weddings and festive occasions.",
          handle: "maroon-banarasi-silk-saree",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("SAREE-MAROON-BANARASI", [
            { currency_code: "inr", amount: 599900 },
            { currency_code: "inr", region_id: region.id, amount: 599900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Royal Blue Kanjivaram Saree",
          category_ids: [sareesId],
          description: "Pure Kanjivaram silk saree in royal blue with traditional temple border and golden pallu.",
          handle: "royal-blue-kanjivaram-saree",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("SAREE-BLUE-KANJIVARAM", [
            { currency_code: "inr", amount: 799900 },
            { currency_code: "inr", region_id: region.id, amount: 799900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Ivory Chiffon Party Saree",
          category_ids: [sareesId],
          description: "Elegant ivory chiffon saree with delicate embroidery, ideal for cocktail parties and receptions.",
          handle: "ivory-chiffon-party-saree",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("SAREE-IVORY-CHIFFON", [
            { currency_code: "inr", amount: 299900 },
            { currency_code: "inr", region_id: region.id, amount: 299900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        // ── SALWAR KAMEEZ ──
        {
          title: "Gold Embroidered Sharara Set",
          category_ids: [salwarId],
          description: "Heavily embroidered sharara set in gold with intricate thread work. Comes with matching dupatta.",
          handle: "gold-embroidered-sharara-set",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("SALWAR-GOLD-SHARARA", [
            { currency_code: "inr", amount: 449900 },
            { currency_code: "inr", region_id: region.id, amount: 449900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Ivory Anarkali Suit",
          category_ids: [salwarId],
          description: "Floor-length Anarkali in ivory with delicate floral embroidery and flared silhouette.",
          handle: "ivory-anarkali-suit",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("SALWAR-IVORY-ANARKALI", [
            { currency_code: "inr", amount: 349900 },
            { currency_code: "inr", region_id: region.id, amount: 349900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Teal Palazzo Co-ord Set",
          category_ids: [salwarId],
          description: "Contemporary teal palazzo co-ord set with printed kurta and wide-leg pants.",
          handle: "teal-palazzo-coord-set",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("SALWAR-TEAL-PALAZZO", [
            { currency_code: "inr", amount: 199900 },
            { currency_code: "inr", region_id: region.id, amount: 199900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        // ── LEHENGAS ──
        {
          title: "Blush Pink Bridal Lehenga",
          category_ids: [lehengaId],
          description: "Exquisite blush pink bridal lehenga with heavy zardozi work and full flared skirt. A dream for your special day.",
          handle: "blush-pink-bridal-lehenga",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("LEHENGA-PINK-BRIDAL", [
            { currency_code: "inr", amount: 1299900 },
            { currency_code: "inr", region_id: region.id, amount: 1299900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Emerald Green Party Lehenga",
          category_ids: [lehengaId],
          description: "Stunning emerald green lehenga with sequin work and mirror embellishments. Perfect for festive occasions.",
          handle: "emerald-green-party-lehenga",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("LEHENGA-GREEN-PARTY", [
            { currency_code: "inr", amount: 699900 },
            { currency_code: "inr", region_id: region.id, amount: 699900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        // ── GOWNS ──
        {
          title: "Navy Velvet Evening Gown",
          category_ids: [gownsId],
          description: "Floor-length navy velvet gown with a structured bodice and elegant A-line silhouette.",
          handle: "navy-velvet-evening-gown",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("GOWN-NAVY-VELVET", [
            { currency_code: "inr", amount: 499900 },
            { currency_code: "inr", region_id: region.id, amount: 499900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Burgundy Indo-Western Gown",
          category_ids: [gownsId],
          description: "Contemporary indo-western gown in burgundy with cape sleeves and embroidered yoke.",
          handle: "burgundy-indo-western-gown",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Size", values: sizes }],
          variants: makeVariants("GOWN-BURGUNDY-INDOWESTERN", [
            { currency_code: "inr", amount: 549900 },
            { currency_code: "inr", region_id: region.id, amount: 549900 },
          ]),
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });
  logger.info("Finished seeding products.");

  logger.info("Seeding inventory levels...");
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = inventoryItems.map((item) => ({
    location_id: stockLocation.id,
    stocked_quantity: 100,
    inventory_item_id: item.id,
  }));

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  });
  logger.info("Finished seeding inventory.");
  logger.info("=== Seeding complete! ===");
  logger.info(`Publishable API key ID: ${publishableApiKey.id}`);
}
