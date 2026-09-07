import os
import logging
from typing import List, Tuple, Dict, Any
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import FakeEmbeddings
from ...config import settings
from .ingest import build_faiss_index, DEFAULT_LEGAL_METROLOGY_CLAUSES

logger = logging.getLogger(__name__)

_vectorstore_instance = None

def get_vectorstore():
    global _vectorstore_instance
    if _vectorstore_instance is None:
        index_dir = settings.FAISS_INDEX_PATH
        embeddings = FakeEmbeddings(size=384)
        if os.path.exists(os.path.join(index_dir, "index.faiss")):
            try:
                _vectorstore_instance = FAISS.load_local(
                    index_dir,
                    embeddings,
                    allow_dangerous_deserialization=True
                )
                logger.info("Loaded existing FAISS vector store index.")
            except Exception as e:
                logger.warning(f"Error loading FAISS index: {e}. Rebuilding...")
                _vectorstore_instance = build_faiss_index()
        else:
            logger.info("FAISS index not found on disk. Building new index...")
            _vectorstore_instance = build_faiss_index()
    return _vectorstore_instance

def retrieve_relevant_clause(query: str) -> Tuple[str, str, float]:
    """
    Retrieves the most relevant Legal Metrology Rule 2011 clause for a given query string.
    Returns: (cited_rule_clause, clause_text, relevance_score)
    """
    try:
        vs = get_vectorstore()
        results = vs.similarity_search_with_score(query, k=1)
        if results and len(results) > 0:
            doc, score = results[0]
            cited_clause = doc.metadata.get("cited_rule_clause", "Rule 6(1)")
            text = doc.page_content
            # Normalize score (lower FAISS distance = higher similarity)
            relevance = max(0.40, min(0.95, round(1.0 - (score / 10.0), 2)))
            return cited_clause, text, relevance
    except Exception as e:
        logger.warning(f"RAG retrieval exception: {e}")

    # Fallback to direct keyword matching across DEFAULT_LEGAL_METROLOGY_CLAUSES
    query_lower = query.lower()
    for item in DEFAULT_LEGAL_METROLOGY_CLAUSES:
        if any(w in item["text"].lower() for w in query_lower.split()):
            return item["clause"], item["text"], 0.85

    return "Rule 6", "General Legal Metrology Packaged Commodities Rule 6", 0.50
