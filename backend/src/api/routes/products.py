from fastapi import APIRouter, HTTPException
from ...services.product_master import get_product_by_gtin, list_all_products_master
from ...services.barcode_lookup import lookup_external_gtin
from ...db.mongo import get_database

router = APIRouter(tags=["Product Master & Barcode Lookup"])

@router.get("/api/products/lookup/{gtin}")
@router.get("/api/barcode/lookup/{gtin}")
async def lookup_product_by_gtin_endpoint(gtin: str):
    code = gtin.strip()
    
    # 1. Local Database Lookup (Fast path)
    prod = await get_product_by_gtin(code)
    if prod:
        return {
            "found": True,
            "source": "Local_Product_Master",
            "product": prod
        }

    # 2. External GTIN Registry Fallback (Open Food Facts / GS1)
    ext_res = lookup_external_gtin(code)
    if ext_res.get("found"):
        ext_product = ext_res["product"]
        
        # Cache external product hit into local MongoDB products collection
        db = get_database()
        if db is not None:
            try:
                await db.products.replace_one({"barcode": code}, ext_product, upsert=True)
            except Exception:
                pass
                
        return ext_res

    # 3. Explicit Not-Found Response (No silent dummy data creation)
    return {
        "found": False,
        "source": "none",
        "message": f"GTIN {code} not registered in local or external product registries."
    }

@router.get("/api/products/master")
async def list_products_master_endpoint():
    products = await list_all_products_master()
    return {
        "total_products": len(products),
        "products": products
    }
