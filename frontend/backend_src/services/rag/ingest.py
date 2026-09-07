import os
import logging
from typing import List
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_community.document_loaders import PyPDFLoader
    from langchain_community.vectorstores import FAISS
    from langchain_community.embeddings import FakeEmbeddings
    from langchain_core.documents import Document
    LANGCHAIN_AVAILABLE = True
except Exception:
    LANGCHAIN_AVAILABLE = False
from ...config import settings

logger = logging.getLogger(__name__)

# Core Rule Clauses for Default Index
DEFAULT_LEGAL_METROLOGY_CLAUSES = [
    {
        "clause": "Rule 6(1)(a)",
        "text": "Every package shall bear thereon the name and address of the manufacturer, or where the manufacturer is not the packer, the name and address of the manufacturer and packer and for any imported package the name and address of the importer."
    },
    {
        "clause": "Rule 6(1)(b)",
        "text": "The common or generic names of the commodity contained in the package and in case of packages with more than one product, the name and number or quantity of each product shall be mentioned on the package."
    },
    {
        "clause": "Rule 6(1)(c)",
        "text": "The net quantity, in terms of standard unit of weight or measure or number of the commodity contained in the package shall be declared prominently on the principal display panel."
    },
    {
        "clause": "Rule 6(1)(d)",
        "text": "The month and year in which the commodity is manufactured or pre-packed or imported shall be declared on the package in numbers or letters as MM/YYYY."
    },
    {
        "clause": "Rule 6(1)(e)",
        "text": "The maximum retail price at which the commodity in packaged form may be sold to the ultimate consumer shall be declared as 'MRP Rs. XX.XX (inclusive of all taxes)' or 'MRP ₹ XX.XX (incl. of all taxes)'."
    },
    {
        "clause": "Rule 6(1)(e) Amendment 2021",
        "text": "Declaration of unit sale price shall be declared on pre-packaged commodities where net quantity is more than 1 kg or 1 L, indicating price per kg or price per L."
    },
    {
        "clause": "Rule 6(2)",
        "text": "Every declaration required to be made under these rules shall be legible, prominent, definite, plain and unambiguous and shall be printed in a color contrasting with the background of the label."
    },
    {
        "clause": "Rule 7",
        "text": "Principal Display Panel Requirements: All mandatory declarations under Rule 6 shall be grouped together in one prominent location on the principal display panel without interleaving advertisements."
    },
    {
        "clause": "Rule 6(1)(f)",
        "text": "Name, address, telephone number, e-mail address of the person who or the office which can be contacted in case of consumer complaints shall be printed on every package."
    },
    {
        "clause": "Rule 6(10A) Amendment 2026",
        "text": "Every e-commerce entity selling imported products shall provide the product listings of such imported products in a searchable and sortable filter specifying the country of origin."
    }
]

def build_faiss_index():
    """
    Ingests PDF files from data directory or builds FAISS vector store with Legal Metrology Rules & Amendments.
    """
    documents = []
    
    if os.path.exists(settings.DATA_DIR):
        pdf_files = [f for f in os.listdir(settings.DATA_DIR) if f.lower().endswith(".pdf")]
        for pdf_file in pdf_files:
            pdf_path = os.path.join(settings.DATA_DIR, pdf_file)
            try:
                logger.info(f"Loading PDF rules from {pdf_path}...")
                loader = PyPDFLoader(pdf_path)
                raw_docs = loader.load()
                splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
                chunks = splitter.split_documents(raw_docs)
                documents.extend(chunks)
                logger.info(f"Split {pdf_file} into {len(chunks)} rule chunks.")
            except Exception as e:
                logger.warning(f"PDF loading note for {pdf_file}: {e}")

    if not documents:
        documents = [
            Document(
                page_content=item["text"],
                metadata={"cited_rule_clause": item["clause"]}
            )
            for item in DEFAULT_LEGAL_METROLOGY_CLAUSES
        ]

    # Use lightweight embeddings for local execution
    embeddings = FakeEmbeddings(size=384)
    vectorstore = FAISS.from_documents(documents, embeddings)
    
    index_dir = settings.FAISS_INDEX_PATH
    os.makedirs(index_dir, exist_ok=True)
    vectorstore.save_local(index_dir)
    logger.info(f"FAISS index successfully saved to {index_dir}")
    return vectorstore

if __name__ == "__main__":
    build_faiss_index()
