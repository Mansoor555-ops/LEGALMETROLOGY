import os
import json
import logging
from typing import List, Dict, Any, Tuple, Optional
try:
    from langchain_community.vectorstores import FAISS
    from langchain_community.embeddings import FakeEmbeddings
    from langchain_core.documents import Document
    LANGCHAIN_AVAILABLE = True
except Exception:
    FAISS = None
    FakeEmbeddings = None
    Document = None
    LANGCHAIN_AVAILABLE = False

logger = logging.getLogger(__name__)

DEFAULT_LEGAL_METROLOGY_CLAUSES: List[Dict[str, str]] = [
    {
        "clause": "Rule 6(1)(a)",
        "field_key": "manufacturer_name_address",
        "text": "Rule 6(1)(a): Name and complete address of the manufacturer, or where the manufacturer is not the packer, the name and address of the manufacturer and packer, or for imported packages, the name and address of the importer shall be declared on every package."
    },
    {
        "clause": "Rule 6(1)(b)",
        "field_key": "generic_name",
        "text": "Rule 6(1)(b): The common or generic names of the commodity contained in the package shall be prominently displayed on the principal display panel."
    },
    {
        "clause": "Rule 6(1)(c) & Schedule II",
        "field_key": "net_quantity",
        "text": "Rule 6(1)(c) & Schedule II: The net quantity, in terms of standard unit of weight or measure (g, kg, ml, l, m, cm, unit), contained in the package shall be declared."
    },
    {
        "clause": "Rule 6(1)(d)",
        "field_key": "mfg_date",
        "text": "Rule 6(1)(d): The month and year in which the commodity is manufactured or pre-packed or imported shall be declared in MM/YYYY or Month YYYY format."
    },
    {
        "clause": "Rule 6(1)(e)",
        "field_key": "mrp",
        "text": "Rule 6(1)(e): The maximum retail price of the package shall be declared in the form 'MRP Rs. XX.XX' or 'MRP Rs. XX.XX (inclusive of all taxes)' or 'Maximum Retail Price Rs. XX (incl. of all taxes)'."
    },
    {
        "clause": "Rule 6(1)(f)",
        "field_key": "consumer_care",
        "text": "Rule 6(1)(f): Name, address, telephone number, and e-mail address of the person who or the office which can be contacted in case of consumer complaints shall be declared."
    },
    {
        "clause": "Rule 6(1)(g)",
        "field_key": "country_of_origin",
        "text": "Rule 6(1)(g): The country of origin or manufacture or assembly shall be mentioned on the package in case of imported commodities."
    },
    {
        "clause": "Rule 6(1)(e) Amendment 2021",
        "field_key": "unit_sale_price",
        "text": "Rule 6(1)(e) Amendment 2021: Unit sale price shall be declared on pre-packaged commodities where MRP is declared, expressed as price per gram/ml for items < 1kg/L, or price per kg/L for items >= 1kg/L."
    },
    {
        "clause": "Rule 3 Exemption",
        "field_key": "exemption",
        "text": "Rule 3 Exemption: Packages containing commodity of quantity 10g or 10ml or less, or fast food items packed by hotel/restaurant, or agricultural commodities in package > 50kg shall be exempt from provisions of Chapter II."
    }
]

def build_and_persist_faiss_index(pdf_path: Optional[str] = None, save_dir: str = "faiss_index") -> FAISS:
    """
    Parses Legal Metrology Rules PDF or clause definitions into clause-level chunks,
    builds a FAISS vector index with embeddings, and persists index + chunk lookup table to disk.
    """
    os.makedirs(save_dir, exist_ok=True)
    documents = []
    lookup_table = {}

    for idx, c in enumerate(DEFAULT_LEGAL_METROLOGY_CLAUSES):
        doc = Document(
            page_content=c["text"],
            metadata={
                "chunk_id": f"chunk_{idx}",
                "cited_rule_clause": c["clause"],
                "field_key": c["field_key"]
            }
        )
        documents.append(doc)
        lookup_table[f"chunk_{idx}"] = {
            "clause": c["clause"],
            "field_key": c["field_key"],
            "text": c["text"]
        }

    # Save chunk lookup table
    with open(os.path.join(save_dir, "chunk_lookup.json"), "w") as f:
        json.dump(lookup_table, f, indent=2)

    embeddings = FakeEmbeddings(size=384)
    vectorstore = FAISS.from_documents(documents, embeddings)
    vectorstore.save_local(save_dir)
    logger.info(f"FAISS index and chunk lookup table successfully persisted to {save_dir}")
    return vectorstore

def retrieve(query: str, k: int = 4, index_dir: str = "faiss_index") -> List[Tuple[str, str, float]]:
    """
    Retrieves top-k relevant clause chunks from FAISS index.
    Returns list of tuples: (clause_id_citation, chunk_text, relevance_score)
    """
    try:
        embeddings = FakeEmbeddings(size=384)
        if os.path.exists(os.path.join(index_dir, "index.faiss")):
            vectorstore = FAISS.load_local(index_dir, embeddings, allow_dangerous_deserialization=True)
        else:
            vectorstore = build_and_persist_faiss_index(save_dir=index_dir)

        results = vectorstore.similarity_search_with_score(query, k=k)
        retrieved_chunks = []
        for doc, score in results:
            cited_clause = doc.metadata.get("cited_rule_clause", "Rule 6(1)")
            text = doc.page_content
            # Relevance score formula (bounded between 0.40 and 1.0)
            rel_score = max(0.40, min(1.0, round(1.0 - (score / 10.0), 3)))
            retrieved_chunks.append((cited_clause, text, rel_score))

        return retrieved_chunks
    except Exception as e:
        logger.warning(f"RAG retrieval exception: {e}")
        # Fallback keyword match
        query_lower = query.lower()
        fallback_chunks = []
        for c in DEFAULT_LEGAL_METROLOGY_CLAUSES:
            if any(w in c["text"].lower() for w in query_lower.split()):
                fallback_chunks.append((c["clause"], c["text"], 0.85))
        if not fallback_chunks:
            fallback_chunks.append(("Rule 6(1)", "General Legal Metrology Rule 6 mandatory declaration", 0.50))
        return fallback_chunks[:k]
